module.exports = {
  "options": {
    "jshintrc": true,
    "reporter": require("jshint-stylish")
  },
  "all": [
    "js/**/*.js",
    "tests/**/*.js",
    "!tests/lib/**/*.js"
  ]
};
