module.exports = {
  all: {
    options: {
      baseUrl: "js",
      name: "../bower_components/almond/almond",
      include: "validation",
      out: "dist/validation.js",
      optimize: "none",
      findNestedDependencies: true,
      generateSourceMaps: true,
      wrap: {
        startFile: 'js/build/start.frag',
        endFile: 'js/build/end.frag'
      }
    }
  }
};
