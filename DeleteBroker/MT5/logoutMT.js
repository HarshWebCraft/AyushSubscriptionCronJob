const axios = require("axios");

const logoutMT5 = async (req, res) => {
  console.log(req.body)
  
  const { login_id, email } = req.body;
  console.log("logout run");
  if (!login_id || !email) {
    return res.status(400).json({
      status: "error",
      message: "login_id and email are required",
    });
  }

  try {
    // Forward request to Python VPS
    const response = await axios.post(
      "http://83.147.29.11:8001/logoutMT5",
      {
        login_id,
      },
      {
        timeout: 60000, // 60 seconds timeout
      }
    );

    // Check if logout was successful
    if (response.data.status !== "success") {
      return res.status(400).json({
        status: "error",
        message: response.data.message || "Logout failed",
        vps_response: response.data,
      });
    }

    // Send success response to frontend
    return res.status(200).json({
      status: "success",
      message: "Logout successful and user data updated",
    });
  } catch (error) {
    // Handle errors
    if (error.response) {
      // Python VPS returned an error response
      return res.status(error.response.status || 400).json({
        status: "error",
        message: error.response.data.detail || "Error from VPS",
        vps_response: error.response.data,
      });
    } else if (error.request) {
      // No response received from VPS
      return res.status(504).json({
        status: "error",
        message: "No response from VPS. Please check VPS availability.",
      });
    } else {
      // Other errors (e.g., database or network issues)
      return res.status(500).json({
        status: "error",
        message: `Internal server error: ${error.message}`,
      });
    }
  }
};

module.exports = logoutMT5;
