# Performance Test Using K6

## Overview
This repository provides a setup for performance testing using k6 with additional extensions for a web dashboard. The test scripts in the test folder and the variables in the .env file are used to benchmark the performance of APIs built with Node.js (using Express) and Golang (using Gin). Each API connects to either a SQL database (PostgreSQL) or a NoSQL database (MongoDB).

## Getting Started

### 1. Run Setup Script
Use the `setup.sh` script to download xk6 via Docker with the necessary extensions for the web dashboard and environment variables support.

```bash
sh setup.sh
```

### 2. Create Environment Variables File
Create a `.env` file in the root directory of the project with the required variables. You can use the `.example.env` file as a reference.

```plaintext
# .env
# Add your environment variables here following the example provided in .example.env
```

### 3. Example Test Script
Refer to the `example.test.js` file for a general boilerplate of how to write test scenarios using k6.

### 4. Setup Report Directories
Create the following directories to store the test results:

```bash
mkdir -p reports/dist reports/html
```

You can also customize the report directories in the `package.json` script `p-test`.

### 5. Run Performance Tests
To run a test, use the following command. The `.env` file will be automatically loaded when the test runs:

```bash
npm run p-test -- path/to/yourTestFile.js
```

### 6. Override Environment Variables
If you need to override any environment variables from the `.env` file, you can run the test with additional flags:

```bash
npm run p-test -- path/to/yourTestFile.js -e VARIABLE_NAME=VALUE
```
