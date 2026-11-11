
// The application's languages: what is decided before .NET starts.
//
// The language has to be known here, not in C#: it is passed to Blazor.start() and the strings below are
// shown when .NET has not loaded at all. Everything from Blazor onwards uses Strings/*.resx.
//
// To add a language: one entry in LANGUAGES, plus the .<code>.resx files and <SatelliteResourceLanguages>.

class CyberShelfLanguage {
    static STORAGE_KEY = "cybershelf-edu.language";
    static DEFAULT_LANGUAGE = "en";

    // Keys are primary language subtags. "name" is written in its own language, as a language selector needs it.
    static LANGUAGES = {
        en: {
            culture: "en-US",
            name: "English",
            strings: {
                Loading: "Loading",
                UnhandledError: "An unhandled error has occurred.",
                LoadStalled: "Loading is taking too long. Check your internet connection and reload the page.",
                Reload: "Reload"
            }
        },
        ru: {
            culture: "ru-RU",
            name: "Русский",
            strings: {
                Loading: "Загрузка",
                UnhandledError: "Произошла непредвиденная ошибка.",
                LoadStalled: "Загрузка идёт слишком долго. Проверьте подключение к интернету и перезагрузите страницу.",
                Reload: "Перезагрузить"
            }
        }
    };

    _code;

    get culture() {
        return CyberShelfLanguage.LANGUAGES[this._code].culture;
    }

    getString(key) {
        return CyberShelfLanguage.LANGUAGES[this._code].strings[key];
    }

    // Called from C# (LanguageService)
    list() {
        return Object.values(CyberShelfLanguage.LANGUAGES).map(({ culture, name }) => ({ culture, name }));
    }

    // Called from C# (LanguageService). The app reads its language only at startup, hence the reload.
    // location.reload() rather than a forced navigation: this keeps the short welcome screen.
    select(culture) {
        try {
            localStorage.setItem(CyberShelfLanguage.STORAGE_KEY, culture);
        }
        catch (err) {
            console.warn("The language choice cannot be saved:", err);
        }

        location.reload();
    }

    // The primary subtag, if the application has such a language
    _match(tag) {
        const code = (tag || "").toLowerCase().split("-")[0];
        return Object.hasOwn(CyberShelfLanguage.LANGUAGES, code) ? code : null;
    }

    _readSaved() {
        try {
            return localStorage.getItem(CyberShelfLanguage.STORAGE_KEY);
        }
        catch {
            return null;
        }
    }

    // The user's choice, then the first browser preference the application has, then the default
    _resolve() {
        const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];

        for (const tag of [this._readSaved(), ...preferred]) {
            const code = this._match(tag);
            if (code) return code;
        }

        return CyberShelfLanguage.DEFAULT_LANGUAGE;
    }

    // index.html holds the English text, so a string is replaced only when there is a translation for it
    _translateDocument = () => {
        for (const hte of document.querySelectorAll("[data-i18n]")) {
            const text = this.getString(hte.dataset.i18n);
            if (text) hte.textContent = text;
        }

        for (const hte of document.querySelectorAll("[data-i18n-label]")) {
            const text = this.getString(hte.dataset.i18nLabel);
            if (text) hte.setAttribute("aria-label", text);
        }
    };

    constructor() {
        this._code = this._resolve();
        document.documentElement.lang = this._code;

        if (document.readyState !== "loading") {
            this._translateDocument();
        } else {
            document.addEventListener("DOMContentLoaded", this._translateDocument);
        }
    }

} // class CyberShelfLanguage

window.CyberShelfLanguage = new CyberShelfLanguage();

// ====================================================================
