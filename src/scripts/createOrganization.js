import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Organization from "../models/organization.model.js";
import User from "../models/user.model.js";

const createOrganization = async () => {
  let organization;

  try {
    const {
      PROVISION_ORG_NAME,
      PROVISION_OWNER_NAME,
      PROVISION_OWNER_EMAIL,
      PROVISION_OWNER_PASSWORD,
    } = process.env;

    if (
      !PROVISION_ORG_NAME?.trim() ||
      !PROVISION_OWNER_NAME?.trim() ||
      !PROVISION_OWNER_EMAIL?.trim() ||
      !PROVISION_OWNER_PASSWORD
    ) {
      throw new Error("Missing provisioning environment variables");
    }

    if (PROVISION_OWNER_PASSWORD.length < 4) {
      throw new Error("Owner password must be at least 12 characters");
    }

    await mongoose.connect(process.env.CONNECTION_STRING);
    await User.init();

    const email = PROVISION_OWNER_EMAIL.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error("This email is already registered");
    }

    const password = await bcrypt.hash(PROVISION_OWNER_PASSWORD, 12);

    organization = await Organization.create({
      name: PROVISION_ORG_NAME.trim(),
    });

    await User.create({
      organization: organization._id,
      name: PROVISION_OWNER_NAME.trim(),
      email,
      password,
      role: "owner",
    });

    console.log("Organization and owner created successfully");
    console.log(`Organization: ${organization.name}`);
    console.log(`Owner email: ${email}`);
  } catch (error) {
    if (organization) {
      try {
        await Organization.deleteOne({ _id: organization._id });
      } catch {
        console.error(
          "Could not clean up the organization. Check the database.",
        );
      }
    }

    console.error("Organization setting up failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

createOrganization();
