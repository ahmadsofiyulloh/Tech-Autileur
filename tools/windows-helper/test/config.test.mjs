import assert from "node:assert/strict";
import test from "node:test";

import { getFlowAccountConfig } from "../src/index.mjs";

test("resolves legacy chrome_profile_path configs", () => {
  const result = getFlowAccountConfig(
    {
      flow_accounts: {
        "FLOW-EXAMPLE": {
          chrome_profile_path: "C:/Profiles/Flow",
        },
      },
    },
    {
      flow_account_code: "FLOW-EXAMPLE",
      chrome_profile_lane_key: null,
    },
  );

  assert.equal(result.chrome_profile_path, "C:/Profiles/Flow");
  assert.equal(result.lane_key, "DEFAULT");
});

test("resolves the requested chrome profile lane", () => {
  const result = getFlowAccountConfig(
    {
      flow_accounts: {
        "FLOW-EXAMPLE": {
          lanes: [
            {
              lane_key: "utama",
              chrome_profile_path: "C:/Profiles/Main",
              active: true,
            },
            {
              lane_key: "cadangan",
              chrome_profile_path: "C:/Profiles/Backup",
              active: false,
            },
          ],
        },
      },
    },
    {
      flow_account_code: "FLOW-EXAMPLE",
      chrome_profile_lane_key: "cadangan",
    },
  );

  assert.equal(result.chrome_profile_path, "C:/Profiles/Backup");
  assert.equal(result.lane_key, "cadangan");
});

test("uses the single active lane when no lane key is provided", () => {
  const result = getFlowAccountConfig(
    {
      flow_accounts: {
        "FLOW-EXAMPLE": {
          lanes: [
            {
              lane_key: "utama",
              chrome_profile_path: "C:/Profiles/Main",
              active: true,
            },
            {
              lane_key: "cadangan",
              chrome_profile_path: "C:/Profiles/Backup",
              active: false,
            },
          ],
        },
      },
    },
    {
      flow_account_code: "FLOW-EXAMPLE",
      chrome_profile_lane_key: null,
    },
  );

  assert.equal(result.chrome_profile_path, "C:/Profiles/Main");
  assert.equal(result.lane_key, "utama");
});

test("rejects ambiguous lanes without an explicit lane key", () => {
  assert.throws(
    () =>
      getFlowAccountConfig(
        {
          flow_accounts: {
            "FLOW-EXAMPLE": {
              lanes: [
                {
                  lane_key: "utama",
                  chrome_profile_path: "C:/Profiles/Main",
                  active: true,
                },
                {
                  lane_key: "cadangan",
                  chrome_profile_path: "C:/Profiles/Backup",
                  active: true,
                },
              ],
            },
          },
        },
        {
          flow_account_code: "FLOW-EXAMPLE",
          chrome_profile_lane_key: null,
        },
      ),
    /Multiple active lanes configured/,
  );
});
