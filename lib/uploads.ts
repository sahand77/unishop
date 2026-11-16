import { join, resolve } from "node:path";

export const dataDir = () => process.env.UNISHOP_DATA_DIR
  ? resolve(/* turbopackIgnore: true */ process.env.UNISHOP_DATA_DIR)
  : join(process.cwd(),"data");