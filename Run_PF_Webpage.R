library(rstudioapi)

# Define the path
path <- "/Users/rodneycuevas/Documents/Claude App Scripts/Prescribed Fire Dashboard/prescribed-fire-dashboard"

# Start the command in a new RStudio Terminal
term_id <- terminalExecute(paste0("cd '", path, "' && npm run dev"))

# Open the dashboard URL in your browser
utils::browseURL("http://localhost:3000")