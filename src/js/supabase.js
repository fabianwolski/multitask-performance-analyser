// Supabase service layer
class SupabaseService {
  constructor() {
    this.url = CONFIG.SUPABASE_URL;
    this.key = CONFIG.SUPABASE_KEY;
  }

  /**
   * Fetch user session data by UUID
   * @param {string} uuid - User unique identifier
   * @returns {Promise<Object|null>} User session data or null if not found
   */
  async getUserSession(uuid) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/user_sessions?unique_id=eq.${uuid}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching user session:", error);
      throw error;
    }
  }

  /**
   * Validate UUID format
   * @param {string} uuid - UUID to validate
   * @returns {boolean} True if valid UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Extract UUID from current URL path
   * @returns {string|null} UUID or null if not found
   */
  getUUIDFromURL() {
    const pathSegments = window.location.pathname.split("/");
    const uuid = pathSegments[pathSegments.length - 1];

    return this.isValidUUID(uuid) ? uuid : null;
  }
}
