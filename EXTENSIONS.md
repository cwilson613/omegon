# Omegon Extension Contract & Manifest Format

All extensions (native Rust binaries, Python scripts, TypeScript Node.js apps, OCI containers) communicate with omegon via **JSON-RPC 2.0 over stdin/stdout**. This is the universal contract.

## Installation

Extensions live in `~/.omegon/extensions/{name}/`. Each extension directory must contain:

```
~/.omegon/extensions/{name}/
├── manifest.toml              # Required: extension metadata + runtime config
├── target/release/{binary}    # For native (RuntimeConfig::Native)
└── (any supporting files)
```

Or for OCI:

```
~/.omegon/extensions/{name}/
├── manifest.toml              # RuntimeConfig::Oci with image name
└── (optional: Dockerfile if rebuilding locally)
```

## manifest.toml Format

```toml
[extension]
name = "my-extension"
version = "0.1.0"
description = "What this extension does"

[runtime]
# For native Rust/Go/compiled binaries:
type = "native"
binary = "target/release/my-extension"

# OR for OCI containers:
# type = "oci"
# image = "my-registry/my-extension:latest"

[startup]
# Optional: method to call for health check (e.g., "get_tools")
ping_method = "get_tools"
# How long to wait (ms) for health check response
timeout_ms = 5000
```

## JSON-RPC Protocol

Omegon sends requests and reads responses on stdin/stdout, one JSON object per line (ndjson).

### Request Format

```json
{"jsonrpc":"2.0","id":1,"method":"get_tools","params":{}}
```

### Response Format

```json
{"jsonrpc":"2.0","id":1,"result":[...]}
```

Or error:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid Request"}}
```

### Notifications (server → client, no response expected)

```json
{"jsonrpc":"2.0","method":"shutdown","params":{}}
```

## Required Methods

Every extension must implement these two RPC methods:

### `get_tools` — Declare available tools

**Request:**
```json
{"jsonrpc":"2.0","id":1,"method":"get_tools","params":{}}
```

**Response:** Array of tool definitions

```json
{
  "jsonrpc":"2.0",
  "id":1,
  "result":[
    {
      "name":"my_tool",
      "label":"My Tool",
      "description":"What my tool does",
      "parameters":{
        "type":"object",
        "properties":{
          "arg1":{"type":"string"}
        },
        "required":["arg1"]
      }
    }
  ]
}
```

Schema for each tool:
- `name` (string) — identifier used in `execute_tool` calls
- `label` (string) — human-readable name for UI
- `description` (string) — what the tool does
- `parameters` (JSON Schema) — input schema (object with properties, required array)

### `execute_tool` — Run a tool

**Request:**
```json
{
  "jsonrpc":"2.0",
  "id":2,
  "method":"execute_tool",
  "params":{
    "name":"my_tool",
    "args":{"arg1":"value"}
  }
}
```

**Response:** Tool result (text content)

```json
{
  "jsonrpc":"2.0",
  "id":2,
  "result":{
    "content":[{"type":"text","text":"Tool output here"}],
    "details":{}
  }
}
```

Or error:

```json
{
  "jsonrpc":"2.0",
  "id":2,
  "error":{"code":-32603,"message":"Internal error: tool failed"}
}
```

## Runtime Modes

### Native Binary

For `RuntimeConfig::Native { binary = "..." }`:

```bash
# Omegon spawns it with:
./path/to/binary --rpc

# OR detects --rpc flag from manifest [startup] section
# and spawns accordingly
```

The binary reads JSON-RPC requests from stdin, writes responses to stdout.

**Example (Rust):**
```rust
#[tokio::main]
async fn main() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    
    let mut line = String::new();
    while reader.read_line(&mut line).await.is_ok() && !line.is_empty() {
        let req: JsonRpcRequest = serde_json::from_str(&line)?;
        let resp = match req.method {
            "get_tools" => { /* return tools */ },
            "execute_tool" => { /* run tool */ },
            _ => { /* error */ }
        };
        stdout.write_all(format!("{}\n", serde_json::to_string(&resp)?).as_bytes()).await?;
        line.clear();
    }
}
```

### OCI Container

For `RuntimeConfig::Oci { image = "..." }`:

```bash
# Omegon spawns it with:
podman run --rm -i my-registry/my-extension:latest

# Container receives stdin, writes stdout, inherits stderr
```

The container process must:
1. Read JSON-RPC requests from stdin
2. Write JSON-RPC responses to stdout (ndjson)
3. Exit cleanly on EOF or SIGTERM

**Example Dockerfile (Python):**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
ENTRYPOINT ["python", "extension.py"]
```

**Example (Python):**
```python
import sys
import json

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        req = json.loads(line)
        
        if req['method'] == 'get_tools':
            result = [
                {"name": "my_tool", "label": "My Tool", "description": "...", "parameters": {...}}
            ]
        elif req['method'] == 'execute_tool':
            tool_name = req['params']['name']
            args = req['params']['args']
            result = {"content": [{"type": "text", "text": f"Output of {tool_name}"}], "details": {}}
        else:
            result = None
            error = {"code": -32601, "message": "Method not found"}
        
        resp = {
            "jsonrpc": "2.0",
            "id": req.get('id'),
            "result": result if 'error' not in locals() else None,
            "error": error if 'error' in locals() else None,
        }
        print(json.dumps(resp))
        sys.stdout.flush()

if __name__ == '__main__':
    main()
```

## Discovery & Registration

On startup, omegon:

1. Scans `~/.omegon/extensions/` for subdirectories
2. Looks for `manifest.toml` in each directory
3. Parses the manifest
4. Spawns the process (native binary or `podman run`)
5. Calls `get_tools` to fetch available tools
6. Registers the extension as a Feature with the EventBus
7. Logs success/failure for each extension

If an extension fails to spawn or health-check, omegon logs a warning and continues.

## Examples

### Example 1: Rust Binary (scribe-rpc)

**manifest.toml:**
```toml
[extension]
name = "scribe-rpc"
version = "0.1.0"
description = "Engagement tracking"

[runtime]
type = "native"
binary = "target/release/scribe-rpc"
```

**Binary location:** `~/.omegon/extensions/scribe-rpc/target/release/scribe-rpc`

**Behavior:**
- `scribe-rpc --rpc` spawned by omegon
- Reads JSON-RPC on stdin, writes on stdout
- Implements get_tools() and execute_tool()

### Example 2: Python OCI Container

**manifest.toml:**
```toml
[extension]
name = "python-analyzer"
version = "0.1.0"
description = "Python code analyzer"

[runtime]
type = "oci"
image = "my-registry/python-analyzer:latest"
```

**Dockerfile:**
```dockerfile
FROM python:3.11
WORKDIR /app
COPY extension.py .
ENTRYPOINT ["python", "extension.py"]
```

**Behavior:**
- `podman run --rm -i my-registry/python-analyzer:latest` spawned by omegon
- Container's entrypoint (python script) handles RPC protocol
- Implements get_tools() and execute_tool()

## Debugging

To test an extension locally:

```bash
# For native binary:
echo '{"jsonrpc":"2.0","id":1,"method":"get_tools","params":{}}' | \
  ~/.omegon/extensions/scribe-rpc/target/release/scribe-rpc --rpc

# For OCI:
echo '{"jsonrpc":"2.0","id":1,"method":"get_tools","params":{}}' | \
  podman run --rm -i my-registry/python-analyzer:latest
```

You should get a JSON response with the tool list.

## Migration from pi (TypeScript Extensions)

If you have a pi extension:

1. **Extract business logic** into a Rust binary or containerized service
2. **Add RPC handler** that implements `get_tools()` and `execute_tool()`
3. **Create manifest.toml** and install to `~/.omegon/extensions/{name}/`
4. Done — omegon discovers and registers it automatically

No TypeScript glue needed. RPC is the contract.

---

**Omegon treats all extensions uniformly.** Whether it's Rust, Python, TypeScript in a container, Go, or anything else — if it speaks JSON-RPC 2.0 over stdin/stdout, it works.
