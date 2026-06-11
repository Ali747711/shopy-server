import { describe, it, expect } from "vitest";
import { addressInputSchema } from "../address.validator";

const valid = {
  fullName: "John Doe",
  phone: "+1 555 000 0000",
  address1: "123 Main St",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  country: "United States",
};

describe("addressInputSchema", () => {
  it("accepts a complete address", () => {
    expect(addressInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional label and isDefault", () => {
    const r = addressInputSchema.safeParse({ ...valid, label: "Home", isDefault: true });
    expect(r.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { city, ...rest } = valid;
    expect(addressInputSchema.safeParse(rest).success).toBe(false);
  });

  it("treats empty address2 as undefined", () => {
    const r = addressInputSchema.safeParse({ ...valid, address2: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address2).toBeUndefined();
  });
});
