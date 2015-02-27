/**
 * Example validations.
 */
(function() {
  "use strict";

  // @TODO: This will be removed when Validation gets refactored.
  function validateNotBlank(string, done, success, failure) {
    if( string !== "" ) {
      return done({
        success: true,
        message: success
      });
    } else {
      return done({
        success: false,
        message: failure
      });
    }
  }

  // # Add validation functions...

  // ## Name
  // Greets the user when they enter their name.
  window.DS.Validation.registerValidationFunction("name", function(string, done) {
    validateNotBlank(string, done,
      "Hey, " + string + "!",
      "We need your first name."
    );
  });

  window.DS.Validation.registerValidationFunction("last_name", function(string, done) {
    validateNotBlank(string, done,
      "Got it, " + string + "!",
      "We need your last name."
    );
  });

  // ## Birthday
  // Validates correct date input, reasonable birthdate, and says a nice message.
  window.DS.Validation.registerValidationFunction("birthday", function(string, done) {
    var birthday, birthMonth, birthDay, birthYear, format;

    // Parse date from string
    if( /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(string) ) {
      // US formatting
      birthday = string.split("/");
      birthMonth = parseInt(birthday[0]);
      birthDay = parseInt(birthday[1]);
      birthYear = parseInt(birthday[2]);
    } else {
      return done({
        success: false,
        message: "Enter your birthday MM/DD/YYYY!"
      });
    }

    // fail if incorrect month
    if (birthMonth > 12 || birthMonth === 0) {
      return done({
        success: false,
        message: "That doesn't seem right."
      });
    }

    //list of last days in months and check for leap year
    var endDates = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if(((birthYear % 4 === 0) && (birthYear % 100 !== 0)) || (birthYear % 400 === 0)){
      endDates[2] = 29;
    }

    // fail if incorrect day
    if (birthDay > endDates[birthMonth]) {
      return done({
        success: false,
        message: "That doesn't seem right."
      });
    }

    // calculate age
    // Source: http://stackoverflow.com/questions/4060004/calculate-age-in-javascript#answer-7091965
    var birthDate = new Date(birthYear, birthMonth - 1, birthDay);
    var now = new Date();
    var age = now.getFullYear() - birthDate.getFullYear();
    var m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 0)  {
      return done({
        success: false,
        message: "Are you a time traveller?"
      });
    } else if( age > 0 && age <= 25  ) {

      if (birthDate.getMonth() === now.getMonth() && now.getDate() === birthDate.getDate() ) {
        return done({
          success: true,
          message: "Wow, happy birthday!"
        });
      } else if ( age < 10) {
        return done({
          success: true,
          message: "Wow, you're " + age + "!"
        });
      } else {
        return done({
          success: true,
          message: "Cool, " + age + "!"
        });
      }

    } else if (age > 25 && age < 130) {
      return done({
        success: true,
        message: "Got it!"
      });
    } else if (string === "") {
      return done({
        success: false,
        message: "We need your birthday."
      });
    } else {
      return done({
        success: false,
        message: "That doesn't seem right."
      });
    }
  });

})();
