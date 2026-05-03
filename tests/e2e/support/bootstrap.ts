import { promises as fs } from "node:fs";
import path from "node:path";

export type SmokeBootstrapState = {
  run_tag: string;
  base_url: string;
  user: {
    id: string;
    email: string;
    password: string;
  };
  workspace: {
    id: string;
    code: string;
    name: string;
  };
  affiliate_profile: {
    id: string;
    code: string;
    name: string;
  };
  product: {
    id: string;
    code: string;
    name: string;
  };
  intake: {
    id: string;
    code: string;
  };
  drive_items: {
    workspace_root_id: string;
    seed_character_id: string;
    environment_id: string;
    product_image_id: string;
    shopee_screenshot_id: string;
  };
};

export const smokeStateDir = path.join(process.cwd(), ".playwright", ".state");
export const smokeBootstrapStatePath = path.join(smokeStateDir, "smoke-bootstrap.json");
export const smokeAuthStatePath = path.join(process.cwd(), ".playwright", ".auth", "smoke.json");

export async function readSmokeBootstrapState() {
  const raw = await fs.readFile(smokeBootstrapStatePath, "utf8");
  return JSON.parse(raw) as SmokeBootstrapState;
}

export async function writeSmokeBootstrapState(state: SmokeBootstrapState) {
  await fs.mkdir(smokeStateDir, { recursive: true });
  await fs.writeFile(smokeBootstrapStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function makeSmokeTag() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

