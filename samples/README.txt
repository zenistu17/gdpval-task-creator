==========================================
  GDPVal Task Creator - Reference Example
==========================================

This folder contains a sample task submission showing
the correct folder structure and file formats.

FOLDER STRUCTURE:
-----------------

sample-task/
├── task.yaml           # Task description, difficulty, metadata
├── solution.sh         # Reference solution script
├── Dockerfile          # Container setup
├── docker-compose.yaml # Docker configuration
├── run-tests.sh        # Test runner script
├── data/               # Input files for the task
│   ├── input.csv
│   └── config.json
└── tests/              # Test files
    └── test_outputs.py


KEY FILES EXPLAINED:
--------------------

1. task.yaml
   - Contains the task instruction/description
   - Specifies difficulty (easy/medium/hard)
   - Defines category, tags, sector, occupation
   - Sets timeout and duration estimates

2. solution.sh
   - Reference solution that solves the task
   - Used to validate the task is solvable
   - Should produce correct outputs in /app/output/

3. data/
   - All input files the agent will use
   - CSVs, JSONs, images, audio, video, etc.
   - Files are copied to /app/data/ in container

4. tests/test_outputs.py
   - Pytest tests to validate the solution
   - Checks output files exist and are correct
   - Can use LLM judge for subjective evaluation


For more examples, see:
- https://github.com/parsewave/contributions-doolbarez/pull/5
- https://github.com/parsewave/contributions-vanosius/pull/3
