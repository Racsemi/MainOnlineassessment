# CODE-RUNNER.md

## Code Runner Subsystem
The Code Runner is an isolated execution engine for RACSEMI Assess, designed to safely execute untrusted candidate code.

## Execution Model
We use **Docker** for executing code rather than raw Node `child_process.spawn()` directly on the host. This prevents filesystem traversal, network pivoting, and CPU starvation.

### Ephemeral Containers
Every execution spins up a fresh, ephemeral Docker container using the specific language runtime image. The container is immediately destroyed after execution (`--rm`).

### Supported Languages & Images
- Node.js: `node:18-alpine`
- Python: `python:3.10-alpine`
- C/C++: `gcc:11`
- Java: `openjdk:17-alpine`
- Go: `golang:1.20-alpine`

### Security Constraints
- **Network Disabled**: `--network none`
- **Memory Limit**: `--memory <limit>m`
- **CPU Limit**: Controlled via timeout (5000ms limit).

## Example Invocation
```bash
docker run --rm -i --network none --memory 256m python:3.10-alpine python -c "print('hello')"
```
