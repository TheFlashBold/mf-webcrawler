const mongoose = require('mongoose');

module.exports = function (app,) {

    return new mongoose.Schema({
        preset: {
            type: String
        },
        url: {
            type: String
        },
        data: {
            type: mongoose.Schema.Types.Mixed
        },
        timestamp: {
            type: Date
        }
    });
};
