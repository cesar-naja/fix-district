// Forward standard root Playwright commands to the E2E workspace.
// All browser-test configuration remains in e2e/.
module.exports = require("./e2e/playwright.config").default;
