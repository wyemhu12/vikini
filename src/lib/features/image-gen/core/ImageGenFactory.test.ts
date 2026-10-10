import { describe, it, expect } from "vitest";
import { ImageGenFactory } from "./ImageGenFactory";
import { GeminiNativeImageProvider } from "../providers/GeminiNativeImageProvider";
import { ReplicateImageProvider } from "../providers/ReplicateImageProvider";
import { OpenAIImageProvider } from "../providers/OpenAIImageProvider";

describe("ImageGenFactory (TC-IMG-03)", () => {
  it("should return a GeminiNativeImageProvider instance for 'gemini'", () => {
    const provider = ImageGenFactory.getProvider("gemini");
    expect(provider).toBeInstanceOf(GeminiNativeImageProvider);
    expect(provider.id).toBe("gemini-native");
  });

  it("should return a GeminiNativeImageProvider instance for 'gemini-native' alias", () => {
    const provider = ImageGenFactory.getProvider("gemini-native");
    expect(provider).toBeInstanceOf(GeminiNativeImageProvider);
    expect(provider.id).toBe("gemini-native");
  });

  it("should preserve singleton identity across multiple getProvider calls for the same key", () => {
    const provider1 = ImageGenFactory.getProvider("gemini");
    const provider2 = ImageGenFactory.getProvider("gemini");
    expect(provider1).toBe(provider2);

    const rep1 = ImageGenFactory.getProvider("replicate");
    const rep2 = ImageGenFactory.getProvider("replicate");
    expect(rep1).toBe(rep2);
  });

  it("should return a ReplicateImageProvider instance for 'replicate'", () => {
    const provider = ImageGenFactory.getProvider("replicate");
    expect(provider).toBeInstanceOf(ReplicateImageProvider);
    expect(provider.id).toBe("replicate");
  });

  it("should return an OpenAIImageProvider instance for 'openai'", () => {
    const provider = ImageGenFactory.getProvider("openai");
    expect(provider).toBeInstanceOf(OpenAIImageProvider);
    expect(provider.id).toBe("openai");
  });

  it("should throw an error when an unsupported provider ID is requested", () => {
    expect(() => ImageGenFactory.getProvider("unsupported")).toThrow(
      "Image Provider 'unsupported' not supported"
    );
    expect(() => ImageGenFactory.getProvider("invalid-id")).toThrow(
      "Image Provider 'invalid-id' not supported"
    );
  });
});
