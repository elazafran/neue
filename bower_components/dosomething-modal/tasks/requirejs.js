module.exports = {
  all: {
    options: {
      baseUrl: "",
      name: "bower_components/almond/almond",
      include: "js/modal",
      insertRequire: ["js/modal"],
      out: "dist/modal.js",
      wrap: true,
      preserveLicenseComments: false,
      generateSourceMaps: true,
      optimize: "uglify2"
    }
  }
};
