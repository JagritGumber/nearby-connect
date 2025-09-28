import { databaseMiddleware } from "../lib/database";
import { AuthContext } from "../lib/auth";

export interface DefaultContext {
  Bindings: CloudflareBindings;
  Variables: {
    client: ReturnType<typeof databaseMiddleware>["client"];
    db: ReturnType<typeof databaseMiddleware>["db"];
  } & AuthContext["Variables"];
}