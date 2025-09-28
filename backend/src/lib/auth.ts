import { createClerkClient, verifyToken } from "@clerk/backend";
import { Context, Next } from "hono";
import { DefaultContext } from "../types/context";

export interface AuthUser {
  id: string;
  email: string;
  username?: string | undefined;
  displayName?: string | undefined;
  avatar?: string | undefined;
}

export interface AuthContext {
  Variables: {
    user: AuthUser | null;
    clerk: ReturnType<typeof createClerkClient>;
  };
}

// Initialize Clerk client
export const createClerkMiddleware = () => {
  return async (c: Context<DefaultContext>, next: Next) => {
    const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
    try {
      const token = c.req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        c.set("user", null);
        c.set("clerk", clerk);
        await next();
        return;
      }

      // Verify the token with Clerk
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (!payload.sub) {
        c.set("user", null);
        c.set("clerk", clerk);
        await next();
        return;
      }

      // Get user data from Clerk
      const user = await clerk.users.getUser(payload.sub);

      const authUser: AuthUser = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        username: user.username || undefined,
        displayName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.username || undefined,
        avatar: user.imageUrl || undefined,
      };

      c.set("user", authUser);
      c.set("clerk", clerk);
      await next();
    } catch (error) {
      console.error("Authentication error:", error);
      c.set("user", null);
      c.set("clerk", clerk);
      await next();
    }
  };
};

// Middleware to require authentication
export const requireAuth = async (c: Context<AuthContext>, next: Next) => {
  const user = c.get("user");

  if (!user) {
    return c.json(
      {
        success: false,
        error: "Authentication required",
        timestamp: Date.now(),
      },
      401
    );
  }

  await next();
};

// Helper function to get current user
export const getCurrentUser = (c: Context): AuthUser | null => {
  return c.get("user");
};

// Helper function to get Clerk client
export const getClerkClient = (c: Context) => {
  return c.get("clerk");
};
