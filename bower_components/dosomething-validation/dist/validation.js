(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    //Allow using this built library as an AMD module
    //in another project. That other project will only
    //see this AMD call, not the internal modules in
    //the closure below.
    define([], factory);
  } else {
    //Browser globals case. Just assign the
    //result to a property on the global.
    root.DS = root.DS || {};
    root.DS.Validation = factory();
  }
}(this, function () {
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../bower_components/almond/almond", function(){});

/**
 * Pub/Sub events: Allows modules to communicate via publishing
 * and subscribing to events.
 *
 * Based on Addy Osmani's Pubsubz, licensed under the GPL.
 * https://github.com/addyosmani/pubsubz
 * http://jsfiddle.net/LxPrq/
 */

define('events',[],function() {
  

  var topics = {};
  var subUid = -1;

  var publish = function(topic, args) {
    if (!topics[topic]) {
      return false;
    }

    setTimeout(function() {
      var subscribers = topics[topic],
      len = subscribers ? subscribers.length : 0;

      while(len--) {
        subscribers[len].func(topic, args);
      }
    }, 0);

    return true;
  };

  var subscribe = function(topic, func) {
    if (!topics[topic]) {
      topics[topic] = [];
    }

    var token = (++subUid).toString();
    topics[topic].push({
      token: token,
      func: func
    });

    return token;
  };

  var unsubscribe = function(token) {
    for (var m in topics) {
      if (topics[m]) {
        for (var i = 0, j = topics[m].length; i < j; i++) {
          if (topics[m][i].token === token) {
            topics[m].splice(i, 1);
            return token;
          }
        }
      }
    }

    return false;
  };

  // Export public API
  return {
    publish: publish,
    subscribe: subscribe,
    unsubscribe: unsubscribe
  };
});

/**
 * Client-side form validation logic. Form element is validated based
 * on `data-validate` attribute, and validation output is placed in
 * corresponding `<label>`.
 *
 * Validations can be added later by extending `NEUE.Validation.Validations`.
 * Validators can be added later by extending `NEUE.Validation.Validators`.
 *
 * finished validating with a boolean `success` and a plain-text `message`
 * value. (Alternatively, a `suggestion` value can be passed which will
 * prompt the user "Did you mean {suggestion}?".
 *
 * ## Usage Notes:
 * - Input field must have `data-validate` attribute.
 * - If adding input fields to the DOM after load, run `prepareFields`
 */

define('validation',['require','./events'],function(require) {
  

  var $ = window.jQuery;
  var Events = require("./events");
  var validations = [];

  /**
   * Prepares form label DOM to display validation messages & register event handler
   * @param {jQuery} $fields Fields to register validation handlers to.
   */
  var prepareFields = function($fields) {
    $fields.each(function() {
      var $field = $(this);

      prepareLabel( $("label[for='" + $field.attr("id") + "']") );

      $field.on("blur", function(event) {
        event.preventDefault();
        validateField( $field );
      });
    });
  };

  /**
   * Prepare field label DOM to display validation messages.
   * @param {jQuery} $label Label element to prepare.
   */
  var prepareLabel = function($label) {
    // Check to make sure we haven't already prepared this before
    if($label.find(".validation").length === 0) {
      var $innerLabel = $("<div class='validation'></div>");
      $innerLabel.append("<div class='validation__label'>" + $label.html() + "</div>");
      $innerLabel.append("<div class='validation__message'></div>");

      $label.html($innerLabel);
    }
  };

  /**
   * Trigger a validation on a form element.
   * @param {jQuery}   $field                            Form element to be validated.
   * @param {jQuery}   [force = false]                   Force validation (even on empty fields).
   * @param {function} [callback=showValidationMessage]  Callback function that receives validation result
   */
  var validateField = function($field, force, callback) {
    // Default arguments
    force = typeof force !== "undefined" ? force : false;
    callback = typeof callback !== "undefined" ? callback : function($field, result) {
      showValidationMessage($field, result);
    };

    var validation = $field.data("validate");

    // Trigger any other linked validation
    var validationTrigger = $field.data("validate-trigger");
    if(validationTrigger) {
      validateField( $(validationTrigger) );
    }


    // Don't validate if validation doesn't exist
    if(!validations[validation]) {
      console.error("A validation with the name "+ validation + " has not been registered.");
      return;
    }

    // For <input>, <select>, and <textarea> tags we provide
    // the field's value as a string
    if( isFormField($field) ) {
      // Get field info
      var fieldValue = $field.val();

      // Finally, let's not validate blank fields unless forced to
      if(force || fieldValue !== "") {
        if(validation === "match") {
          var matchFieldValue = $($field.data("validate-match")).val();
          validations[validation].fn(fieldValue, matchFieldValue, function(result) {
            callback($field, result);
          });
        } else {
          validations[validation].fn(fieldValue, function(result) {
            callback($field, result);
          });
        }
      }
    } else {
      // For all other tags, we pass the element directly
      if(validation === "match") {
        var $matchField = $($field.data("validate-match"));
        validations[validation].fn($field, $matchField, function(result) {
          callback($field, result);
        });
      } else {
        validations[validation].fn($field, function(result) {
          callback($field, result);
        });
      }
    }
  };

  /**
   * Register a new validation.
   *
   * @param {String}    name              The name function will be referenced by in `data-validate` attribute.
   * @param {Object}    validation        Collection of validation rules to apply
   * @param {Function}  [validation.fn]   Custom validation
   */
  var registerValidation = function(name, validation) {
    if(validations[name]) {
      throw "A validation function with that name has already been registered";
    }

    validations[name] = validation;
  };

  /**
   * @DEPRECATED: Will be removed in a future version in favor of `registerValidation`.
   */
  var registerValidationFunction = function(name, func) {
    var v = {
      fn: func
    };

    registerValidation(name, v);
  };

  /**
   * Show validation message in markup.
   *
   * @param {jQuery} $field              Field to display validation message for.
   * @param {Object} result              Object containing `success` and either `message` or `suggestion`
   */
  var showValidationMessage = function($field, result) {
    var $fieldLabel = $("label[for='" + $field.attr("id") + "']");
    var $fieldValidation = $fieldLabel.find(".validation");
    var $fieldMessage = $fieldValidation.find(".validation__message");
    var fieldLabelHeight = $fieldLabel.height();
    var fieldMessageHeight;

    $field.removeClass("has-success has-error has-warning shake");
    $fieldMessage.removeClass("has-success has-error has-warning");

    // Highlight/animate field
    if(result.success === true) {
      $field.addClass("has-success");
      $fieldMessage.addClass("has-success");
    } else {
      $field.addClass("has-error");
      $fieldMessage.addClass("has-error");

      if( isFormField($field) ) {
        $field.addClass("shake");
      }

      Events.publish("Validation:InlineError", $fieldLabel.attr("for"));
    }

    // Show validation message
    if(result.message) {
      $fieldMessage.text(result.message);
    }

    if(result.suggestion) {
      $fieldMessage.html("Did you mean " + result.suggestion.full + "? <a href='#' data-suggestion='" + result.suggestion.full + "'class='js-mailcheck-fix'>Fix it!</a>");
      Events.publish("Validation:Suggestion", result.suggestion.domain);
    }

    fieldMessageHeight = $fieldMessage.height();

    // Set label height if it needs to be multiline.
    if(fieldMessageHeight > fieldLabelHeight) {
      $fieldLabel.css("height", fieldMessageHeight + "px");
    } else {
      // Clear previous multiline height if no longer needed.
      $fieldLabel.css("height", "");
    }

    // Animate in the validation message
    $fieldValidation.addClass("is-showing-message");

    $(".js-mailcheck-fix").on("click", function(e) {
      e.preventDefault();

      var $field = $("#" + $(this).closest("label").attr("for"));
      $field.val($(this).data("suggestion"));
      $field.trigger("blur");

      // If Google Analytics is set up, we fire an event to
      // mark that a suggestion has been made
      Events.publish("Validation:SuggestionUsed", $(this).text() );
    });

    $field.on("focus", function() {
      $field.removeClass("has-warning has-error has-success shake");
      $fieldValidation.removeClass("is-showing-message");
      $fieldLabel.css("height", "");
    });

    return result.success;
  };


  /**
   * Disable form submission.
   * @param {jQuery} $form Form to disable submission for.
   */
  var disableFormSubmit = function($form) {
    // Prevent double-submissions
    var $submitButton = $form.find(":submit");

    // Disable that guy
    $submitButton.attr("disabled", true);
    $submitButton.addClass("is-loading");
  };


  /**
   * Re-enable form submission.
   * @param {jQuery} $form Form to enable submission for.
   */
  var enableFormSubmit = function($form) {
    var $submitButton = $form.find(":submit");
    $submitButton.attr("disabled", false);
    $submitButton.removeClass("is-loading is-disabled");
  };

  /**
   * Returns whether element is <input>, <select>, or <textarea>.
   * @param {jQuery} $el  Element to check type of.
   * @return {boolean}
   */
  var isFormField = function($el) {
    var tag = $el.prop("tagName");
    return ( tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" );
  };

  /**
   * Validate form on submit.
   */
  $("body").on("submit", "form", function(event, isValidated) {
    var $form = $(this);
    var $validationFields = $form.find("[data-validate]");

    // Disable form submission to prevent double-clicks.
    disableFormSubmit($form);

    // We want to validate all [data-validate] field that are either required, or have user input.
    $validationFields = $validationFields.map(function() {
      var $this = $(this);
      if(typeof $this.attr("data-validate-required") !== "undefined" || $this.val() !== "") {
        return $this;
      }
    });

    // If no fields should be validated, submit!
    if($validationFields.length === 0) {
      return true;
    }

    if(isValidated === true) {
      // completed a previous runthrough & validated;
      // we're ready to submit the form
      return true;
    } else {
      event.preventDefault();

      var validatedFields = 0;
      var validatedResults = 0;
      var scrolledToError = false;

      $validationFields.each(function() {
        validateField($(this), true, function($field, result) {
          validatedFields++;
          showValidationMessage($field, result);

          if(result.success) {
            validatedResults++;
          }

          // If this is the first error in the form, scroll to it.
          if(!scrolledToError && result.success === false) {
            scrolledToError = true;
            $("html,body").animate({scrollTop: $field.offset().top - 32}, 200);
          }

          // Once we're done validating all fields, check status of form
          if(validatedFields === $validationFields.length) {
            if(validatedResults === $validationFields.length) {
              // we've validated all that can be validated
              Events.publish("Validation:Submitted", $(this).attr("id") );
              $form.trigger("submit", true);
            } else {
              Events.publish("Validation:SubmitError", $(this).attr("id") );
              enableFormSubmit($form);
            }
          }
        });
      });

      return false; // don't submit form, wait for callback with `true` parameter
    }
  });

  // Register the "match" validation.
  registerValidationFunction("match", function(string, secondString, done) {
    if(string === secondString && string !== "") {
      return done({
        success: true,
        message: "Looks good!"
      });
    } else {
      return done({
        success: false,
        message: "That doesn't match."
      });
    }
  });

  $(function() {
    // Prepare the labels on any `[data-validate]` fields in the DOM at load
    prepareFields( $("body").find("[data-validate]") );
  });

  // Attach to namespaced window object
  window.DS = window.DS || {};
  window.DS.Validation = {
    prepareFields: prepareFields,
    registerValidation: registerValidation,
    registerValidationFunction: registerValidationFunction,
    validateField: validateField,
    showValidationMessage: showValidationMessage,
    Validations: validations,
    Events: Events
  };

  return window.DS.Validation;
});

  //The modules for your project will be inlined above
  //this snippet. Ask almond to synchronously require the
  //module value for 'main' here and return it as the
  //value to use for the public API for the built file.
  return require('validation');
}));

//# sourceMappingURL=validation.js.map