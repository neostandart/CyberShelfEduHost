
// What the owner of the site sets for their organization: the palette, the title, the logo and their own styles.
//
// The settings are in branding/branding.json, which is optional and does not come with the application,
// so an update cannot overwrite it. The service worker does not check its hash (see service-worker.published.js).
// It is read here rather than in C#: the welcome screen needs it long before .NET starts.
//
// Radzen has no palette setting: its colours are CSS variables. An inline style on <html> wins over any stylesheet,
// whatever the order of the <link> elements.

class CyberShelfBranding {
    static CONFIG_URL = "branding/branding.json";
    static LOAD_TIMEOUT = 5000;
    static MIN_CONTRAST = 3;                // below this, the colour on a white page is hard to see

    static PALETTES = {
        indigo: "#4340D2",
        navy: "#1B3A66",
        blue: "#0B6E99",
        green: "#1B7F4B",
        burgundy: "#A4243B",
        orange: "#B3560A"
    };

    // The 16x16 favicon: the same drawing as wwwroot/favicon.svg, in the colours of the palette
    static FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">`
        + `<path fill="{color}" d="M2 2h3v6H2zM10 3h3v5h-3zM1 8h14v1H1zM8 9h1v2H8zM2 11h12v4H2z"/>`
        + `<path fill="{dark}" d="M6 1h3v7H6z"/>`
        + `<path fill="#fff" d="M4 12h1v1H4zM6 12h1v1H6zM8 12h1v1H8zM10 12h1v1h-1zM5 13h6v1H5z"/>`
        + `</svg>`;

    // Settled when the settings have been applied, or when it is clear that there are none. Never rejects.
    ready;

    // ---- Colours

    static _parse(hex) {
        return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    }

    static _format(rgb) {
        return "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    }

    // The proportions below are those of the Material theme: they give exactly its shades of #4340D2
    static _mix(rgb, target, share) {
        return rgb.map(v => v * share + target * (1 - share));
    }

    static _luminance(rgb) {
        const [r, g, b] = rgb.map(v => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    static _contrastWithWhite(rgb) {
        return 1.05 / (CyberShelfBranding._luminance(rgb) + 0.05);
    }

    // White or black, whichever is easier to read on this background
    static _textColor(rgb) {
        const luminance = CyberShelfBranding._luminance(rgb);
        return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#000000";
    }

    // Returns the values of the theme variables for one base colour
    static buildVariables(color) {
        const { _parse, _format, _mix, _textColor } = CyberShelfBranding;
        const base = _parse(color);
        const shades = {
            "": base,
            "-light": _mix(base, 255, 0.8),
            "-dark": _mix(base, 0, 0.8),
            "-darker": _mix(base, 0, 0.68)
        };

        const variables = {};
        for (const [suffix, rgb] of Object.entries(shades)) {
            variables[`--rz-primary${suffix}`] = _format(rgb);
            variables[`--rz-on-primary${suffix}`] = _textColor(rgb);
        }

        variables["--rz-primary-lighter"] = `rgba(${base.join(", ")}, 0.12)`;
        variables["--rz-on-primary-lighter"] = color;
        return variables;
    }

    // ---- Settings

    // An explicit colour, otherwise a named palette. Null if neither is set, or the value is not usable.
    _resolveColor(config) {
        if (typeof config.PrimaryColor === "string") {
            if (/^#[0-9a-f]{6}$/i.test(config.PrimaryColor)) return config.PrimaryColor;
            console.warn(`Branding: PrimaryColor must look like #1B7F4B, ignored: ${config.PrimaryColor}`);
        }

        if (typeof config.Palette === "string") {
            const palettes = CyberShelfBranding.PALETTES;
            if (Object.hasOwn(palettes, config.Palette)) return palettes[config.Palette];
            console.warn(`Branding: unknown Palette "${config.Palette}", available: ${Object.keys(palettes).join(", ")}`);
        }

        return null;
    }

    _applyColor(color) {
        const { buildVariables, _contrastWithWhite, _parse } = CyberShelfBranding;

        if (_contrastWithWhite(_parse(color)) < CyberShelfBranding.MIN_CONTRAST) {
            console.warn(`Branding: ${color} is too light, links and outlined buttons will be hard to read on white`);
        }

        const variables = buildVariables(color);
        const style = document.documentElement.style;
        for (const [name, value] of Object.entries(variables)) {
            style.setProperty(name, value);
        }

        this._applyToHead(color, variables["--rz-primary-dark"]);
    }

    _applyToHead(color, dark) {
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);

        // The PNG is for browsers without SVG favicons: it cannot be recoloured, so it must not be chosen instead
        document.querySelector('link[rel="icon"][type="image/png"]')?.remove();

        const svg = CyberShelfBranding.FAVICON.replace("{color}", color).replace("{dark}", dark);
        document.querySelector('link[rel="icon"][type="image/svg+xml"]')
            ?.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
    }

    _applyOrganization(config) {
        const hteOrganization = document.getElementById("Organization");
        if (!hteOrganization) return;

        const hteLogo = document.getElementById("OrganizationLogo");
        const hteTitle = document.getElementById("OrganizationTitle");

        if (typeof config.Title === "string" && config.Title.trim()) {
            hteTitle.textContent = config.Title;
            hteLogo.alt = "";
            hteOrganization.hidden = false;
        }

        if (typeof config.LogoUrl === "string" && config.LogoUrl.trim()) {
            hteLogo.addEventListener("error", () => {
                console.warn(`Branding: the logo cannot be loaded: ${config.LogoUrl}`);
                hteLogo.hidden = true;
            });
            hteLogo.src = config.LogoUrl;
            hteLogo.hidden = false;
            hteOrganization.hidden = false;
        }
    }

    // In #Welcome, after welcome.css: with equal specificity the later stylesheet wins, and the styles go away with the screen.
    // Settled when the stylesheet has loaded or failed to, so that the screen can appear already styled.
    _applyStylesheet(config) {
        const hteWelcome = document.getElementById("Welcome");
        if (!hteWelcome || typeof config.Stylesheet !== "string" || !config.Stylesheet.trim()) return;

        return new Promise(resolve => {
            const hteLink = document.createElement("link");
            hteLink.rel = "stylesheet";
            hteLink.addEventListener("load", resolve);
            hteLink.addEventListener("error", () => {
                console.warn(`Branding: the stylesheet cannot be loaded: ${config.Stylesheet}`);
                resolve();
            });
            hteLink.href = config.Stylesheet;
            hteWelcome.appendChild(hteLink);
        });
    }

    // The file is optional, so its absence is the normal case and not a warning
    async _readConfig() {
        try {
            const response = await fetch(CyberShelfBranding.CONFIG_URL, {
                cache: "no-cache",
                signal: AbortSignal.timeout(CyberShelfBranding.LOAD_TIMEOUT)
            });

            if (response.ok) {
                const config = await response.json();
                if (config && typeof config === "object") return config;
            }
        }
        catch (err) {
            if (err instanceof SyntaxError) {
                console.warn(`Branding: ${CyberShelfBranding.CONFIG_URL} is not valid JSON:`, err);
            }
        }

        return null;
    }

    async _load() {
        const config = await this._readConfig();
        if (!config) return;

        try {
            const color = this._resolveColor(config);
            if (color) this._applyColor(color);

            if (document.readyState === "loading") {
                await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
            }

            this._applyOrganization(config);
            await this._applyStylesheet(config);
        }
        catch (err) {
            console.warn("Branding: the settings cannot be applied:", err);
        }
    }

    constructor() {
        this.ready = this._load();
    }

} // class CyberShelfBranding

window.CyberShelfBranding = new CyberShelfBranding();

// ====================================================================
