// API calls for Gym
const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "GymProject API is running",
        library: "Gymnasium",
        version: "1.0.0"
    });
});

// Available environments
app.get("/api/environments", (req, res) => {
    res.json({
        environments: [
            "CartPole-v1",
            "MountainCar-v0",
            "Acrobot-v1",
            "Pendulum-v1"
        ]
    });
});

// Run a Gymnasium environment
app.post("/api/run", (req, res) => {
    const {
        environment = "CartPole-v1",
        episodes = 1,
        maxSteps = 500
    } = req.body;

    const allowedEnvironments = [
        "CartPole-v1",
        "MountainCar-v0",
        "Acrobot-v1",
        "Pendulum-v1"
    ];

    if (!allowedEnvironments.includes(environment)) {
        return res.status(400).json({
            error: "Invalid environment"
        });
    }

    if (
        !Number.isInteger(episodes) ||
        episodes < 1 ||
        episodes > 100
    ) {
        return res.status(400).json({
            error: "Episodes must be between 1 and 100"
        });
    }

    if (
        !Number.isInteger(maxSteps) ||
        maxSteps < 1 ||
        maxSteps > 10000
    ) {
        return res.status(400).json({
            error: "maxSteps must be between 1 and 10000"
        });
    }

    const python = spawn(
        process.env.PYTHON_PATH || "python",
        [
            "gym_environment.py",
            environment,
            String(episodes),
            String(maxSteps)
        ],
        {
            cwd: __dirname
        }
    );

    let output = "";
    let errors = "";
    let finished = false;

    const timeout = setTimeout(() => {
        if (!finished) {
            python.kill("SIGKILL");
        }
    }, 60000);

    python.stdout.on("data", data => {
        output += data.toString();
    });

    python.stderr.on("data", data => {
        errors += data.toString();
    });

    python.on("error", error => {
        finished = true;
        clearTimeout(timeout);

        if (!res.headersSent) {
            res.status(500).json({
                error: "Could not start Python",
                details: error.message
            });
        }
    });

    python.on("close", code => {
        finished = true;
        clearTimeout(timeout);

        if (res.headersSent) return;

        if (code !== 0) {
            return res.status(500).json({
                error: "Gymnasium execution failed",
                details: errors
            });
        }

        try {
            const result = JSON.parse(output);
            res.json({
                status: "success",
                result
            });
        } catch {
            res.status(500).json({
                error: "Invalid Python response",
                details: errors
            });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`GymProject API running at http://localhost:${PORT}`);
});
