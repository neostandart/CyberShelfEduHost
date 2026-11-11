class CyberShelfAgent {
  static LOGO_ANIMATION = "kf-key-press"; // the last one of the logo animation

  static LOGO_HOLD_TIME = 1700; // pause after the key has been pressed: the flash plays out in it (--flash-delay + --flash-in-time + --flash-fade-time - 0.3 s of the key press in welcome.css)
  static LOGO_GUARD_TIME = 8000; // in case "animationend" never fires; longer than the sequence in welcome.css
  static BRANDING_WAIT_TIME = 800; // a slow network must not leave the screen empty
  static QUICK_HOLD_TIME = 1500; // page reload: logo is shown briefly, no animation
  static FADEOUT_TIME = 1500; // keep in sync with "#Welcome.fadeout" in welcome.css
  static QUICK_FADEOUT_TIME = 400; // keep in sync with "#Welcome.quick.fadeout" in welcome.css
  static STALL_CHECK_TIME = 5000;
  static STALL_LIMIT_TIME = 60000; // no loading progress for this long: offer a reload
  static VERSION_TIMEOUT = 5000;

  _hteWelcome = null;
  _hteApp = null;
  _hteLogo = null;
  _hteFlash = null;
  _hteSpinner = null;
  _hteProgress = null;

  _observer = null;
  _errorObserver = null;
  _bStopped = false;

  _nGuardTimer = 0;
  _nStallTimer = 0;
  _bStallShown = false;

  die() {
    document.removeEventListener("keydown", this._onSkip, true);
    if (this._hteWelcome && this._hteWelcome.parentElement) {
      this._hteWelcome.parentElement.removeChild(this._hteWelcome);
    }
  }

  stop() {
    if (this._hteWelcome && !this._bStopped) {
      this._bStopped = true;
      clearTimeout(this._nGuardTimer);

      this._hteWelcome.classList.add("fadeout");
      this._hteWelcome.classList.remove("fadein");

      if (this._hteApp) {
        this._hteApp.classList.add("running");
      }

      const bQuick = this._hteWelcome.classList.contains("quick");
      setTimeout(
        () => {
          this.die();
        },
        bQuick
          ? CyberShelfAgent.QUICK_FADEOUT_TIME
          : CyberShelfAgent.FADEOUT_TIME,
      );
    }
  }

  fail(err) {
    console.error(err);
    this._setFailed();
    this._showErrorUI(true);
  }

  // Blazor failed to start: the application will not appear, so the loading indicators go away
  _setFailed() {
    this._stopStallWatch();
    this._stopErrorWatch();

    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;

      if (this._hteWelcome) {
        this._hteWelcome.classList.add("failed");
      }
    }
  }

  // Hiding the panel restores the usual text: the app reports its later errors through the same panel
  _showErrorUI(bShow, bStalled = false) {
    const hteErrorUI = document.getElementById("blazor-error-ui");
    if (hteErrorUI) {
      const hteMessage = hteErrorUI.querySelector("[data-i18n]");
      if (hteMessage) {
        hteMessage.textContent = window.CyberShelfLanguage.getString(
          bStalled ? "LoadStalled" : "UnhandledError",
        );
      }

      hteErrorUI.style.display = bShow ? "block" : "none";
    }
  }

  // Most startup failures do not reject Blazor.start(): Blazor only shows its error panel
  _startErrorWatch() {
    const hteErrorUI = document.getElementById("blazor-error-ui");
    if (hteErrorUI) {
      this._errorObserver = new MutationObserver(() => {
        if (hteErrorUI.style.display === "block" && !this._bStallShown) {
          this._setFailed();
        }
      });
      this._errorObserver.observe(hteErrorUI, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
  }

  _stopErrorWatch() {
    if (this._errorObserver) {
      this._errorObserver.disconnect();
      this._errorObserver = null;
    }
  }

  async _loadVersion() {
    try {
      const response = await fetch("appsettings.json", {
        cache: "no-cache",
        signal: AbortSignal.timeout(CyberShelfAgent.VERSION_TIMEOUT),
      });

      if (response.ok) {
        const appsettings = await response.json();
        return (appsettings && appsettings.AppVersion) || null;
      }
    } catch (err) {
      console.warn("Application version is unavailable:", err);
    }

    return null;
  }

  async _showVersion() {
    const version = await this._loadVersion();
    if (version && this._hteWelcome) {
      const hteVersion = this._hteWelcome.querySelector("#AppVersion");
      if (hteVersion) {
        hteVersion.innerText = version;
        hteVersion.classList.add("visible");
      }
    }
  }

  // True if the user reloaded the page (F5, the browser's reload button).
  // Any other way in is a new launch and gets the full animation.
  _isPageReload() {
    const navigation = performance.getEntriesByType("navigation")[0];
    return !!navigation && navigation.type === "reload";
  }

  _getLoadProgress() {
    return document.documentElement.style.getPropertyValue(
      "--blazor-load-percentage-text",
    );
  }

  // The download can hang without any error, in which case Blazor.start() never settles.
  // This is not final: if loading resumes, _onMutation removes the message.
  _startStallWatch() {
    let progress = this._getLoadProgress();
    let nLastChange = Date.now();

    this._nStallTimer = setInterval(() => {
      const current = this._getLoadProgress();
      if (current !== progress) {
        progress = current;
        nLastChange = Date.now();
      } else if (
        !this._bStallShown &&
        Date.now() - nLastChange >= CyberShelfAgent.STALL_LIMIT_TIME
      ) {
        this._bStallShown = true;
        this._showErrorUI(true, true);
      }
    }, CyberShelfAgent.STALL_CHECK_TIME);
  }

  _stopStallWatch() {
    clearInterval(this._nStallTimer);
  }

  _onSkip = () => {
    this._hteWelcome.classList.add("quick");
    this.stop();
  };

  _playLogo() {
    const onLogoPlayed = (ev) => {
      if (ev.animationName === CyberShelfAgent.LOGO_ANIMATION) {
        setTimeout(() => {
          this.stop();
        }, CyberShelfAgent.LOGO_HOLD_TIME);
      }
    };

    this._hteLogo.addEventListener("animationend", onLogoPlayed);
    this._nGuardTimer = setTimeout(() => {
      this.stop();
    }, CyberShelfAgent.LOGO_GUARD_TIME);

    this._hteWelcome.addEventListener("pointerdown", this._onSkip);
    document.addEventListener("keydown", this._onSkip, true);

    this._hteLogo.classList.add("animated");

    if (this._hteFlash) this._hteFlash.classList.add("show");
  }

  _playQuick() {
    this._hteWelcome.classList.add("quick");

    if (this._hteLogo) this._hteLogo.classList.add("quick");

    setTimeout(() => {
      this.stop();
    }, CyberShelfAgent.QUICK_HOLD_TIME);
  }

  _onMutation = (mutationList, observer) => {
    observer.disconnect();
    this._observer = null;

    this._stopStallWatch();
    this._stopErrorWatch();
    if (this._bStallShown) {
      this._showErrorUI(false);
    }

    if (this._hteSpinner) this._hteSpinner.classList.add("hidden");

    if (this._hteProgress) this._hteProgress.classList.add("hidden");

    const bReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (this._hteLogo && !this._isPageReload() && !bReducedMotion) {
      this._playLogo();
    } else {
      this._playQuick();
    }
  };

  // The screen appears in the colours of the organization. Blazor does not wait for this.
  async _fadeIn() {
    await Promise.race([
      window.CyberShelfBranding.ready,
      new Promise((resolve) =>
        setTimeout(resolve, CyberShelfAgent.BRANDING_WAIT_TIME),
      ),
    ]);

    // Two frames: the initial opacity must be painted, or the transition will not run
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this._bStopped) {
          this._hteWelcome.classList.add("fadein");
        }
      });
    });
  }

  async _startBlazor() {
    try {
      // The culture is known before .NET starts, so the right resources are loaded from the outset
      await window.Blazor.start({
        applicationCulture: window.CyberShelfLanguage.culture,
      });
    } catch (err) {
      this.fail(err);
    }
  }

  async start() {
    try {
      this._hteWelcome = document.getElementById("Welcome");
      this._hteApp = document.getElementById("Application");
      this._hteLogo = document.getElementById("Logo");
      this._hteFlash = document.getElementById("Flash");
      this._hteSpinner = document.getElementById("Spinner");
      this._hteProgress = document.getElementById("ProgressText");

      this._showVersion();

      if (this._hteWelcome && this._hteApp) {
        // Tracking the end of the application download
        this._observer = new MutationObserver(this._onMutation);
        const config = { attributes: false, childList: true, subtree: false };
        this._observer.observe(this._hteApp, config);

        this._startStallWatch();
        this._startErrorWatch();

        this._fadeIn();
      } else {
        throw new Error(
          "Incorrect structure the index.html (Welcome or Application elements not found)!",
        );
      }
    } catch (err) {
      console.error(err);
    }

    this._startBlazor();
  }
} // class CyberShelfAgent

//

/* Protection for a non-root path logon */
//const basePath = "/";
//const pathname = window.location.pathname;
//if (pathname !== basePath) {
//    window.location.replace(basePath);
//}

//

window.CyberShelfAgent = new CyberShelfAgent();

function startWelcome() {
  window.CyberShelfAgent.start();
}

if (document.readyState !== "loading") {
  startWelcome();
} else {
  document.addEventListener("DOMContentLoaded", startWelcome);
}

// ====================================================================
