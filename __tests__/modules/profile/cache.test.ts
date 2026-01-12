import { getDatabase } from "@/modules/database";
import {
    clearProfileCache,
    forceRefreshProfile,
    getOrFetchProfile,
} from "@/modules/profile/cache";
import { supabase } from "@/modules/supabase/client";

// Mock dependencies
jest.mock("@/modules/database");
jest.mock("@/modules/supabase/client");
jest.mock("@/utils/logger");

describe("Profile Cache Service", () => {
  const mockUserId = "test-user-123";
  const mockProfileData = {
    user_id: mockUserId,
    name: "Test User",
    age: 28,
    bio: "Test bio",
    intentions: ["friendship"],
    photos: ["https://example.com/photo1.jpg"],
    job_title: "Developer",
    company_name: "Test Company",
    height_cm: 175,
    location: "São Paulo, SP",
    languages: ["pt", "en"],
    education_level: "bachelors",
    zodiac_sign: "aries",
    relationship_status: "single",
    smoking_habit: "never",
    favorite_places: [],
    visited_places_count: 0,
  };

  let mockDatabase: any;
  let mockCollection: any;
  let mockProfile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Profile model
    mockProfile = {
      userId: mockUserId,
      rawData: JSON.stringify(mockProfileData),
      lastFetchedAt: new Date(),
      createdAt: new Date(),
      isStale: false,
      shouldFetch: false,
      data: mockProfileData,
      updateData: jest.fn().mockResolvedValue(undefined),
      markAsDeleted: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };

    // Mock WatermelonDB collection
    mockCollection = {
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([mockProfile]),
      create: jest.fn().mockResolvedValue(mockProfile),
    };

    // Mock Database
    mockDatabase = {
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
      write: jest.fn((callback) => callback()),
    };

    (getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
  });

  describe("getOrFetchProfile", () => {
    it("should return cached profile when available and fresh", async () => {
      // Arrange
      mockProfile.isStale = false;
      mockProfile.shouldFetch = false;
      mockCollection.fetch.mockResolvedValue([mockProfile]);

      // Act
      const result = await getOrFetchProfile(mockUserId);

      // Assert
      expect(result).toBe(mockProfile);
      expect(mockDatabase.collections.get).toHaveBeenCalledWith("profiles");
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it("should return cached profile and trigger background refresh when stale", async () => {
      // Arrange
      mockProfile.isStale = true;
      mockProfile.shouldFetch = true;
      mockCollection.fetch.mockResolvedValue([mockProfile]);
      
      const mockApiResponse = {
        data: { profile: mockProfileData },
        error: null,
      };
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockApiResponse);

      // Act
      const result = await getOrFetchProfile(mockUserId);

      // Assert
      expect(result).toBe(mockProfile);
      
      // Wait for background refresh to start
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "get-public-profile",
        { body: { userId: mockUserId } }
      );
    });

    it("should fetch from API when cache is empty", async () => {
      // Arrange
      mockCollection.fetch.mockResolvedValue([]);
      
      const mockApiResponse = {
        data: { profile: mockProfileData },
        error: null,
      };
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockApiResponse);

      // Act
      const result = await getOrFetchProfile(mockUserId);

      // Assert
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "get-public-profile",
        { body: { userId: mockUserId } }
      );
      expect(mockCollection.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should return null when API fails and no cache exists", async () => {
      // Arrange
      mockCollection.fetch.mockResolvedValue([]);
      
      const mockApiResponse = {
        data: null,
        error: { message: "API Error" },
      };
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockApiResponse);

      // Act
      const result = await getOrFetchProfile(mockUserId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      (getDatabase as jest.Mock).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await getOrFetchProfile(mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("forceRefreshProfile", () => {
    it("should fetch fresh data from API and update cache", async () => {
      // Arrange
      mockCollection.fetch.mockResolvedValue([mockProfile]);
      
      const mockApiResponse = {
        data: { profile: mockProfileData },
        error: null,
      };
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockApiResponse);

      // Act
      const result = await forceRefreshProfile(mockUserId);

      // Assert
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "get-public-profile",
        { body: { userId: mockUserId } }
      );
      expect(mockProfile.updateData).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should return null when API fails", async () => {
      // Arrange
      const mockApiResponse = {
        data: null,
        error: { message: "API Error" },
      };
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockApiResponse);

      // Act
      const result = await forceRefreshProfile(mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("clearProfileCache", () => {
    it("should delete profile from cache", async () => {
      // Arrange
      mockCollection.fetch.mockResolvedValue([mockProfile]);

      // Act
      await clearProfileCache(mockUserId);

      // Assert
      expect(mockProfile.markAsDeleted).toHaveBeenCalled();
    });

    it("should handle empty cache gracefully", async () => {
      // Arrange
      mockCollection.fetch.mockResolvedValue([]);

      // Act
      await clearProfileCache(mockUserId);

      // Assert
      expect(mockProfile.markAsDeleted).not.toHaveBeenCalled();
    });
  });
});
