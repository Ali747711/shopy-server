import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { UserType } from "../src/libs/enums/user.enum";
import UserModel from "../src/schemas/user.schema";

const run = async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run make-admin -- "user@example.com"');
    process.exit(1);
  }

  await connectDB();
  const res = await UserModel.updateOne(
    { userEmail: email.toLowerCase() },
    { $set: { userRole: UserType.ADMIN } }
  );

  if (res.matchedCount === 0) {
    console.log(`No user found with email: ${email}`);
  } else {
    console.log(
      `✓ ${email} is now ADMIN. Log in again to mint a token with the ADMIN role.`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error("make-admin failed:", e);
  process.exit(1);
});
