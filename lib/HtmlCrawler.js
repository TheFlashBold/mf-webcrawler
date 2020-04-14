const cheerio = require('cheerio');
const Utils = require('./Utils');

class HtmlCrawler {
    select = null;
    schema = {};

    constructor(doc, schema) {
        this.select = cheerio.load(doc);
        this.schema = schema;
    }

    getData() {
        return this.getValue(this.schema, this.select);
    }

    getValue(config, select) {
        if (typeof select !== "function") {
            console.log("[ERROR] seems like your config is wrong :$");
            return null;
        }

        const data = {};
        for (let [key, cfg] of Object.entries(config)) {
            let entry = null;
            const {path, attr, array, properties, modifier} = this._getConfig(cfg);

            const element = path ? select(path) : select();
            let selector = (e) => e;

            if (attr) {
                selector = (e) => select(e).attr(attr);
            } else {
                selector = (e) => select(e).text().trim();
            }

            if (!path && properties) {
                entry = this.getValue(properties, select);
            } else if (array && properties) {
                entry = Utils.fixArray(element).map((e) => {
                    return this.getValue(properties, (path) => path ? select(path, e) : select(e));
                });
            } else if (array) {
                entry = Utils.fixArray(element).map(selector);
            } else if (properties) {
                entry = this.getValue(properties, element);
            } else {
                entry = selector(element);
                if (modifier) {
                    entry = this._applyModifier(entry, modifier);
                }
            }

            data[key] = entry;
        }
        return data;
    }

    // @TODO: make this great again
    _applyModifier(data, modifier) {
        if (!Array.isArray(modifier)) {
            modifier = [modifier];
        }

        for (let mod of modifier) {
            mod = this._getModifierConfig(mod);
            switch (mod.type) {
                case "regex":
                    const regex = new RegExp(mod.regex, mod.options || "");
                    const matches = regex.exec(data);
                    if (mod.first) {
                        data = matches[1] || null;
                    } else {
                        data = matches;
                    }
                    break;
                case "number":
                    data = parseFloat(data.replace(/[^0-9,.]/g, "").replace(/,/g, "."));
                    break;
            }
        }

        return data;
    }

    /**
     * Unifies config
     * @param {string|{path: string}} cfg
     * @return {{path: string}}
     * @private
     */
    _getConfig(cfg) {
        if (typeof cfg === "string") {
            cfg = {
                path: cfg
            };
        }

        return cfg;
    }

    _getModifierConfig(modifier) {
        if (typeof modifier === "string") {
            modifier = {
                type: modifier
            };
        }
        return modifier;
    }
}

module.exports = HtmlCrawler;
