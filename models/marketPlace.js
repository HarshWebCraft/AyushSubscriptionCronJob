const mongoose = require("mongoose");
const { Schema } = mongoose;
const AutoIncrement = require("mongoose-sequence")(mongoose);

// Define the MarketPlace schema
const marketPlaceSchema = new Schema({
  title: { type: String, required: true },
  strategyImage: { type: String, required: true }, // ✅ New field
  strategyType: { type: String, required: true },
  plateformFee: { type: Number, required: true }, // ✅ New field
  premium: { type: Boolean, required: true },
  leverage: { type: String, required: true }, // ✅ New field
  totalReturn: { type: Number, required: true }, // ✅ New field
  capitalRequirement: { type: String, required: true },
  description: { type: String, required: true },
  time: { type: String, required: true },
  days: { type: String, required: true },
  subscribeCount: { type: Number, required: true },
  deployedCount: { type: Number, required: true },
  createdBy: { type: String, required: true },
  dateOfCreation: { type: Date, required: true },
  strategyMakerXalgoId: { type: String, required: true }, // ✅ New field
  isReadyForMarketPlace: { type: Boolean, required: true, default: false },
  aboutTrader: {
    type: String,
    default: "",
  },
  currency: { type: String },
  isRemove: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  Broker: { type: String },
});

// Auto-increment plugin for `id`
marketPlaceSchema.plugin(AutoIncrement, { inc_field: "id" });

const MarketPlace = mongoose.model("MarketPlace", marketPlaceSchema);

module.exports = MarketPlace;

// mongoose.connect(
//   "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority",
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   }
// );

// // Function to insert a new document
// async function addMarketPlaceData() {
//   try {
//     const newEntry = new MarketPlace({
//       id: 4,
//       title: "Tarakash",
//       strategyType: "Calendar Spread",
//       premium: false,
//       capitalRequirement: "Rs. 1,20,000 for 1X multiplier",
//       description:
//         "Capitalizes on time decay differences, suitable for moderately bullish or bearish trends.",
//       time: "09:30 AM - 3:00 PM",
//       days: "Executes On - Tuesdays and Thursdays",
//       subscribeCount: 500,
//       deployedCount: 180,
//       createdBy: "Team Delta",
//       dateOfCreation: new Date("2023-04-15"),
//     });

//     await newEntry.save();
//     console.log("Data added successfully to MarketPlace collection.");
//   } catch (error) {
//     console.error("Error adding data:", error);
//   }
// }

// // Run the function to add data
// addMarketPlaceData();
