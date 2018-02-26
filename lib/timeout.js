'use strict';

module.exports = function (delay, value) {
    return new Promise(function (resolve) {
        setTimeout(resolve, delay, value);
    });
};
