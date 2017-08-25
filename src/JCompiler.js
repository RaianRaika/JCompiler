"use strict";

const _target = new WeakMap()
const _content = new WeakMap();
const parser = require('./lib/Parser').getInstance();
const commons = require('./lib/Commons').getInstance();
const generalCompare = (obj, rules) => {
    return (commons.validator.ruleGeneralValidator(obj, rules.general) &&
        commons.validator.ruleDateValidator(obj, rules.dateTime));
};
let Handler = null;

/**
 * The JCompiler Main Object
 *
 * @description this object get the target ( search condition)
 *              and the content ( select rows ) and generate
 *              the query for waterlines and load data
 *
 * @param {JSONTargetObject} target - the target search
 * @param {JSONContentObject} content - the selected column */

class JCompiler {
    constructor(target, content) {
        Handler = this;
        this.target = parser.RawTargetParser(target);
        this.content = parser.RawContentParser(content);
    }

    get target() {
        return _target.get(Handler);
    }

    set target(value) {
        _target.set(Handler, value);
    }

    get content() {
        return _content.get(Handler);
    }

    set content(value) {
        _content.set(Handler, value);
    }

    /**
     * @typedef waterlineQueryFunction
     * @type {Function}
     * @param {Function} CB - {@link waterlineQueryCallBack}
     */

    /**
     * @typedef waterlineQueryCallBack
     * @type {Function}
     * @param {Error} error
     * @param {JSONObject} List
     */

    loadPNS(sails, prefix) {
        if (prefix == undefined)
            prefix = '';
        let functionBody = 'return sails' + prefix + '.devices';

        let rules = {
            general: {}
        };
        let flightFilter, bookingFilter, deviceFilter, emptyRule;
        emptyRule = flightFilter = bookingFilter = deviceFilter = function (obj) {
            return true;
        }

        const target = this.target;
        const topKey = Object.keys(target);
        if (topKey.indexOf('device') != -1) {
            // add the device data models to function body
            rules = parser.loadConditions(target['device'], new Function('rules', 'return rules.config.isDevice'));
            deviceFilter = function (obj) {
                return (commons.validator.ruleDateValidator(obj, rules.dateTime));
            }
        }
        if (topKey.indexOf('flight') != -1) {
            flightFilter = function (obj) {
                rules = parser.loadConditions(target['flight'], new Function('rules', 'return rules.config.isFlight'));
                return generalCompare(obj, rules);
            }
        }
        if (topKey.indexOf('booking') != -1) {
            bookingFilter = function (obj) {
                let rules = parser.loadConditions(target['booking'], new Function('rules', 'return rules.config.isBooking'));
                return generalCompare(obj, rules);
            }
        }
        return new Promise((resolve, reject) => {
            (new Function('sails', functionBody))
                .call(this, sails)
                .find({where: rules.general})
                .populate(['anyFlights', 'anyBooking'])
                .then((devices) => {
                    "use strict";
                    const pns = devices.filter(device => {
                        let out;
                        if (!deviceFilter(device)) {
                            out = false;
                        }
                        else {

                            out = true;
                            if (flightFilter !== emptyRule)
                                out = out && device.anyFlights.filter(flightFilter).length !== 0;
                            if (bookingFilter !== emptyRule)
                                out = out && device.anyBooking.filter(bookingFilter).length !== 0;

                        }

                        return out;
                    });
                    return [pns];
                })
                .spread(results => {
                    "use strict";
                    resolve(results);
                })
        });

    }
}

module.exports = JCompiler;