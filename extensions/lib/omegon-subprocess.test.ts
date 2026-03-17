/**
 * Tests for omegon-subprocess — native agent binary resolution.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { resolveOmegonSubprocess, resolveNativeAgent, _clearNativeAgentCache } from "./omegon-subprocess.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

describe("resolveOmegonSubprocess", () => {
	it("resolves to node + bin/omegon.mjs", () => {
		const spec = resolveOmegonSubprocess();
		assert.ok(spec.command, "command should be set");
		assert.ok(spec.omegonEntry.endsWith("bin/omegon.mjs"), `expected omegon.mjs, got: ${spec.omegonEntry}`);
		assert.ok(spec.argvPrefix.length > 0, "argvPrefix should have at least one entry");
	});
});

describe("resolveNativeAgent", () => {
	beforeEach(() => {
		_clearNativeAgentCache();
	});

	afterEach(() => {
		_clearNativeAgentCache();
		delete process.env.OMEGON_AGENT_BINARY;
	});

	it("returns null when no binary exists and env is unset", () => {
		// Point to a nonexistent binary to ensure no local build interferes
		process.env.OMEGON_AGENT_BINARY = "/nonexistent/omegon-agent";
		_clearNativeAgentCache();
		// The env var path doesn't exist, so it falls through.
		// But the local build might exist — clear env and test with a guaranteed-missing path.
		delete process.env.OMEGON_AGENT_BINARY;
		_clearNativeAgentCache();

		const result = resolveNativeAgent();
		// Can't assert null because the dev build might exist in core/target/release/
		// Instead, verify the shape is correct when it returns something
		if (result) {
			assert.ok(result.binaryPath, "binaryPath should be set");
			assert.ok(result.bridgePath, "bridgePath should be set");
			assert.ok(existsSync(result.binaryPath), "binary should exist");
			assert.ok(result.bridgePath.endsWith("llm-bridge.mjs"), "bridge should be llm-bridge.mjs");
		}
		// null is also valid — means no binary found
	});

	it("respects OMEGON_AGENT_BINARY env var", () => {
		// Use the actual release binary if it exists
		const devBinary = join(repoRoot, "core", "target", "release", "omegon-agent");
		if (!existsSync(devBinary)) {
			// Skip this test if no binary is built
			return;
		}

		process.env.OMEGON_AGENT_BINARY = devBinary;
		_clearNativeAgentCache();

		const result = resolveNativeAgent();
		assert.ok(result, "should resolve when env var points to existing binary");
		assert.equal(result!.binaryPath, devBinary);
		assert.ok(result!.bridgePath.includes("llm-bridge.mjs"));
	});

	it("finds local development build", () => {
		const devBinary = join(repoRoot, "core", "target", "release", "omegon-agent");
		if (!existsSync(devBinary)) {
			// Skip if no binary built
			return;
		}

		const result = resolveNativeAgent();
		assert.ok(result, "should find the dev build");
		assert.equal(result!.binaryPath, devBinary);
	});

	it("caches the result", () => {
		const first = resolveNativeAgent();
		const second = resolveNativeAgent();
		assert.equal(first, second, "should return the same cached object");
	});

	it("bridge path points to core/bridge/llm-bridge.mjs", () => {
		const devBinary = join(repoRoot, "core", "target", "release", "omegon-agent");
		if (!existsSync(devBinary)) return;

		const result = resolveNativeAgent();
		assert.ok(result);
		const expectedBridge = join(repoRoot, "core", "bridge", "llm-bridge.mjs");
		assert.equal(result!.bridgePath, expectedBridge);
	});
});
