import { describe, expect, it } from "vitest";
import { buildCommandSubject, buildProtocolSubject, buildSessionEventSubject } from "../src/subjects.js";

describe("subjects", () => {
	it("builds bee protocol, command, and session event subjects", () => {
		expect(buildProtocolSubject("bee.agent.pi.default")).toBe("bee.agent.pi.default.protocol");
		expect(buildCommandSubject("bee.agent.pi.default")).toBe("bee.agent.pi.default.command");
		expect(buildSessionEventSubject("bee.agent.pi.default", "bee:slack:T123:C123:1711111111.000100")).toBe(
			"bee.agent.pi.default.session.bee_slack_T123_C123_1711111111_000100.event",
		);
	});
});
