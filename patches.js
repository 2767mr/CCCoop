function replacePlayerModel(...args) {
    const original = sc.model.player;
    sc.model.player = sc.model.player2;

    this.parent(...args);

    sc.model.player = original;
}

function replacePlayerModelIn(cb) {
    return function(...args) {
        const original = sc.model.player;
        sc.model.player = sc.model.player2;

        cb.apply(this, args);

        sc.model.player = original;
    }
}

const originalGetEntity = ig.Event.getEntity;
ig.Event.getEntity = function (b, a) {
    if (b && b.playerTwo) {
        return ig.game.player2Entity;
    }

    return originalGetEntity.call(this, b, a);
};

ig.ActorEntity.inject({
    onFallFromEdge(direction) {
        const coll = this.coll;
        if (this.jumpingEnabled
            && (coll.accelDir.x || coll.accelDir.y)
            && Vec2.length(coll.vel) / coll.maxVel > 0.5
            && (!direction || Vec2.dot(direction, coll.accelDir) / Vec2.length(direction) / Vec2.length(coll.accelDir) > 0.5)) {

            let isJumpDisabled = false;

            const groundEntity = ig.EntityTools.getGroundEntity(this);
            if (groundEntity && groundEntity.onTopEntityJumpFar) {
                isJumpDisabled = groundEntity.onTopEntityJumpFar(this);
            }

            if (!isJumpDisabled) {
                if (coll.float.height) {
                    this.doFloatJump(10, 0.3);
                } else {
                    this.doJump(155, 0, null, this.isPlayer || this.isPlayer2 ? 0.1 : 1);
                }
            }
        }
    },
});

ig.FX_FIRST_TARGET_OPTION.PLAYER = function (a) {
    return ig.game.playerEntity;
};
ig.FX_FIRST_TARGET_OPTION.PLAYER_2 = function (a) {
    return ig.game.player2Entity;
};

sc.GlobalInput.inject({
    onPostUpdate: function () {
        if (!ig.loading) {
            if (!ig.game.isControlBlocked() && sc.model.isGame() && (sc.model.isRunning() || sc.model.isQuickMenuElementSwapEnabled()) && ig.game.player2Entity && !ig.game.player2Entity.isElementChangeBlocked() && !sc.model.player2.hasOverload && !sc.control.charge()) {
                var a = sc.control.elementModeSwitchAlt();
                if (a !== false) {
                    if (!a || a == sc.model.player2.currentElementMode)
                        a = sc.ELEMENT.NEUTRAL;
                    a != sc.model.player2.currentElementMode && sc.model.player2.setElementMode(a);
                }
                (a = sc.control.elementModeScroll()) && sc.model.player2.scrollElementMode(a);
            }
        }
        this.parent();
    }
});

sc.Control.inject({
    interactPressed: function (a, b) {
        return !b && this.autoControl ? this.autoControl.get("interactPressed") : ig.input.pressed("aim") || ig.input.pressed("confirm") || (a ? this.menuBack() : false);
    },
    interactPressedAlt: function (a, b) {
        return !b && this.autoControl ? this.autoControl.get("interactPressed") : ig.gamepad.isButtonPressed(ig.BUTTONS.FACE0) || (a ? this.menuBack() : false);
    },
    interactDown: function () {
        return this.autoControl ? this.autoControl.get("interactDown") : ig.input.state("aim");
    },
    interactDownAlt: function () {
        return this.autoControl ?
            this.autoControl.get("interactDown") : ig.gamepad.isButtonDown(ig.BUTTONS.FACE0);
    },

    elementModeSwitch: function () {
        return this.autoControl ? this.autoControl.get("heatMode") ? sc.ELEMENT.HEAT : this.autoControl.get("coldMode") ?
            sc.ELEMENT.COLD : this.autoControl.get("shockMode") ? sc.ELEMENT.SHOCK : this.autoControl.get("waveMode") ? sc.ELEMENT.WAVE : false : ig.input.pressed("neutral") ? sc.ELEMENT.NEUTRAL : ig.input.pressed("heat") ? sc.ELEMENT.HEAT : ig.input.pressed("cold") ? sc.ELEMENT.COLD : ig.input.pressed("shock") ? sc.ELEMENT.SHOCK : ig.input.pressed("wave") ?
                sc.ELEMENT.WAVE : false;
    },
    elementModeSwitchAlt: function () {
        return this.autoControl ? this.autoControl.get("heatMode") ? sc.ELEMENT.HEAT : this.autoControl.get("coldMode") ?
            sc.ELEMENT.COLD : this.autoControl.get("shockMode") ? sc.ELEMENT.SHOCK : this.autoControl.get("waveMode") ? sc.ELEMENT.WAVE : false : ig.input.pressed("neutral") ? sc.ELEMENT.NEUTRAL : ig.gamepad.isButtonPressed(ig.BUTTONS.DPAD_DOWN) ? sc.ELEMENT.HEAT : ig.gamepad.isButtonPressed(ig.BUTTONS.DPAD_UP) ? sc.ELEMENT.COLD : ig.gamepad.isButtonPressed(ig.BUTTONS.DPAD_RIGHT) ? sc.ELEMENT.SHOCK : ig.gamepad.isButtonPressed(ig.BUTTONS.DPAD_LEFT) ?
                sc.ELEMENT.WAVE : false;
    }
});

sc.PlayerModelTwo = sc.PlayerModel.extend({
    enterElementalOverload: function () {
        if (!this.hasOverload) {
            sc.stats.addMap("element",
                "overload", 1);
            sc.arena.onElementOverload();
            //the 2nd player needs to be referred to here otherwise the zoom and the action lines happen to the player1 despite it is player2 that overloaded
            sc.combat.doDramaticEffect(ig.game.playe2rEntity, ig.game.player2Entity, sc.DRAMATIC_EFFECT.OVERLOAD);
            var a = ig.lang.get("sc.gui.combat.element-overload"),
                //Same goes for the text
                a = new sc.SmallEntityBox(ig.game.player2Entity, a, 1);
            ig.gui.addGuiElement(a);
            this.hasOverload = true;
            this.setElementMode(sc.ELEMENT.NEUTRAL, true);
        }
    },
    setElementMode: function (a, b, c) {
        if (!b && !this.core[sc.PLAYER_CORE.ELEMENT_CHANGE] || !b && !this.hasElement(a))
            return false;
        //player2 needs to be defined here because the check for the current element mode needs to be for player2 not 1, without this player2 can't swtich to player1's element
        if (!c && ig.game.player2Entity && this.currentElementMode != a)
            ig.game.player2Entity.switchedMode = true;
        this.currentElementMode = a;
        sc.stats.addMap("element", "used" + a, 1);
        this.params.setBaseParams(this.elementConfigs[a].baseParams);
        this.params.setModifiers(this.elementConfigs[this.currentElementMode].modifiers);
        sc.Model.notifyObserver(this, sc.PLAYER_MSG.ELEMENT_MODE_CHANGE);
        return true;
    },
});

sc.MessageModel.inject({
    _isSideMessageDelayed: function () {
        return this.parent()
            || !sc.model.isCombatActive()
            && !sc.model.isCombatCooldown()
            && !sc.model.isCutscene()
            && sc.model.player2.hasLevelUp();
    },
});

sc.StartMenu.inject({
    init() {
        this.parent();
        this.buttons.skillsAlt = this._createButtonAlt("skillsAlt", 1, () => {
            sc.menu.pushMenu(sc.MENU_SUBMENU.SKILLS_ALT);
        }, sc.model.player.getCore("MENU_CIRCUIT"));
        this.buttons.equipment2 = this._createButtonAlt("equipment2", 0, () => {
            sc.menu.pushMenu(sc.MENU_SUBMENU.EQUIPMENT_ALT);
        });

        this.addChildGui(this.buttons.skillsAlt);
        this.addChildGui(this.buttons.equipment2);

        this.buttonGroup.addFocusGui(this.buttons.equipment2, 0, 8);
        this.buttonGroup.addFocusGui(this.buttons.skillsAlt, 0, 9);
    },

    showMenu() {
        this.parent();
        this.buttons.skillsAlt.doStateTransition("DEFAULT", false, false, null, 0.032);
        this.buttons.equipment2.doStateTransition("DEFAULT", false, false, null, 0.032);
    },

    _createButtonAlt(name, positionIndex, callback, isQuestionmarks) {
        const buttonPositions = [
            //equipment for p2 menu
            {
                x: 420,
                y: 163
            }, 
            //circuit for p2 menu
            {
                x: 420,
                y: 193
            }];

        const button = new sc.ButtonGui(isQuestionmarks ? "???" : ig.lang.get("sc.gui.menu.menu-titles." + name), sc.BUTTON_MENU_WIDTH);
        button.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
        button.setPos(buttonPositions[positionIndex].x, buttonPositions[positionIndex].y);
        button.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    offsetX: - (sc.BUTTON_MENU_WIDTH + buttonPositions[positionIndex].x)
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        button.setData(ig.lang.get("sc.gui.menu.description." + name));
        button.onButtonPress = callback;
        button.doStateTransition("HIDDEN", true);
        return button;
    }
});

sc.ElementHudGui.inject({
    _updatePos: function () {
        this.parent();
        if (ig.game.playerEntity) {
            this.hook.pos.y += 50; // Shift 50 pixels lower
        }
    }
});

{
    const elementPositions = {};
    elementPositions[sc.ELEMENT.HEAT] = {
        alignX: ig.GUI_ALIGN.X_CENTER,
        alignY: ig.GUI_ALIGN.Y_BOTTOM,
        tile: 2,
        rotate: 0.5,
        pShowX: 16,
        pShowY: 50, // Shifted down
        pHideX: 16,
        pHideY: 82 // Shifted down
    };
    elementPositions[sc.ELEMENT.COLD] = {
        alignX: ig.GUI_ALIGN.X_CENTER,
        alignY: ig.GUI_ALIGN.Y_TOP,
        tile: 0,
        rotate: 0,
        pShowX: 16,
        pShowY: 82, // Shifted down
        pHideX: 16,
        pHideY: 50 // Shifted down
    };
    elementPositions[sc.ELEMENT.SHOCK] = {
        alignX: ig.GUI_ALIGN.X_RIGHT,
        alignY: ig.GUI_ALIGN.Y_CENTER,
        tile: 1,
        rotate: 0.25,
        pShowX: 0,
        pShowY: 66, // Shifted down
        pHideX: 32,
        pHideY: 66 // Shifted down
    };
    elementPositions[sc.ELEMENT.WAVE] = {
        alignX: ig.GUI_ALIGN.X_LEFT,
        alignY: ig.GUI_ALIGN.Y_CENTER,
        tile: 3,
        rotate: 0.75,
        pShowX: 32,
        pShowY: 66, // Shifted down
        pHideX: 0,
        pHideY: 66 // Shifted down
    };
    sc.ElementHudIconGui.inject({
        updateDrawables: function (renderer) {
            if (!this.bigSize && this.iconDir.rotate) {
                renderer.addTransform().setPivot(16, 16).setRotate(this.iconDir.rotate * 2 * Math.PI);
            }

            const currentElementPositions = elementPositions[this.currentElement];
            let dx, dy, size;
            let sx = 0;

            if (this.bigSize) {
                dx = 128 + currentElementPositions.tile * 32;
                dy = 224;
                size = 32;
            } else {
                dx = currentElementPositions ? 136 + (1 + currentElementPositions.tile) * 24 : 136;
                dy = 200;
                size = 24;
                sx = 4;
            }
            renderer.addGfx(this.gfx, sx, 0, dx, dy, size, size);
            if (!this.bigSize && this.iconDir.rotate) {
                renderer.undoTransform();
            }
        }
    });
}

sc.HpHudGuiTwo = ig.GuiElementBase.extend({
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.3,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0
            },
            time: 0.3,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    gfx: new ig.Image("media/gui/status-gui.png"),
    criticalText: null,
    hpNumber: null,
    hpBar: null,
    critical: false,
    criticalTimer: 0,
    init: function (b) {
        this.parent();
        this.setSize(68,
            16);
        this.setPivot(36, 16);
        this.hpNumber = new sc.NumberGui(9999, {
            signed: true,
            transitionTime: 0.5
        });
        this.hpNumber.setPos(12, 1);
        this.addChildGui(this.hpNumber);
        this.criticalText = new sc.TextGui("\\c[1]CRITICAL", {
            font: sc.fontsystem.tinyFont
        });
        this.criticalText.setPos(20, 0);
        this.addChildGui(this.criticalText);
        this.criticalText.hook.localAlpha = 0;
        b = sc.model.player2.params;
        this.hpBar = new sc.HpHudBarGui(b, 48, 3);
        this.hpBar.setPos(12, 9);
        this.addChildGui(this.hpBar);
        sc.Model.addObserver(b, this);
        sc.Model.addObserver(sc.model.player2,
            this);
        sc.Model.addObserver(sc.options, this);
        this.hpNumber.setNumber(b.currentHp, true);
    },
    update: function () {
        if (this.critical) {
            this.hpNumber.hook.localAlpha = 0;
            this.criticalTimer = this.criticalTimer - ig.system.actualTick;
            if (this.criticalTimer <= 0)
                this.criticalTimer = 0.1;
            this.criticalText.hook.localAlpha = this.criticalTimer < 0.05 ? 0 : 1;
        } else {
            this.hpNumber.hook.localAlpha = 1;
            this.criticalTimer = this.criticalText.hook.localAlpha = 0;
        }
        var b = sc.model.player2.hasLevelUp() ? 1 : (sc.model.player2.exp / sc.EXP_PER_LEVEL).limit(0, 1);
        this.hpBar.setExpRatio(b);
    },
    updateDrawables: function (b) {
        b.addGfx(this.gfx, 0, 0, 0, 0, this.hook.size.x, this.hook.size.y);
    },
    modelChanged: function (b, a) {
        if (b == sc.model.player2.params) {
            var d = Math.max(0, b.currentHp);
            a == sc.COMBAT_PARAM_MSG.HP_CHANGED ? this.hpNumber.setNumber(d) : a == sc.COMBAT_PARAM_MSG.STATS_CHANGED ? this.hpNumber.setNumber(d, !this.hook._visible) : a == sc.COMBAT_PARAM_MSG.RESET_STATS && this.hpNumber.setNumber(d, true);
            if (a == sc.COMBAT_PARAM_MSG.HP_CHANGED || a == sc.COMBAT_PARAM_MSG.STATS_CHANGED)
                if (b.getHpFactor() <=
                    sc.HP_LOW_WARNING) {
                    this.hpNumber.setColor(sc.GUI_NUMBER_COLOR.RED);
                    sc.options.get("low-health-warning") && ig.overlay.setCorner("RED", 1, 0.4, 0.5);
                } else {
                    this.hpNumber.setColor(sc.GUI_NUMBER_COLOR.WHITE);
                    sc.options.get("low-health-warning") && ig.overlay.setCorner("RED", 0, 0.4);
                }
            this.critical = b.currentHp <= 0 && !b.defeated;
        } else if (b == sc.model.player2) {
            if (a == sc.PLAYER_MSG.SET_PARAMS || a == sc.PLAYER_MSG.CONFIG_CHANGED) {
                d = sc.model.player2.params;
                this.hpNumber.setNumber(Math.max(0, d.currentHp), true);
                this.hpBar.resetHp();
                this.critical = d.currentHp <= 0 && !d.defeated;
            }
        } else
            b == sc.options && a == sc.OPTIONS_EVENT.OPTION_CHANGED && (this.targetHp / this.maxHp <= sc.HP_LOW_WARNING ? sc.options.get("low-health-warning") ? ig.overlay.setCorner("RED", 1, 0.4, 0.5) : ig.overlay.setCorner("RED", 0, 0.4) : ig.overlay.setCorner("RED", 0, 0.4));
    }
});

sc.SpHudGuiTwo = sc.SpHudGui.extend({
    init: replacePlayerModel,
    update: replacePlayerModel,
    updateDrawables: replacePlayerModel,
    modelChanged: replacePlayerModel,
});

sc.ParamHudGui2 = ig.GuiElementBase.extend({
    transitions: {
        DEFAULT: {
            state: {},
            time: 0,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0
            },
            time: 0,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    level: null,
    hp: null,
    atk: null,
    def: null,
    foc: null,
    _isOut: false,
    init() {
        this.parent();
        this.level = new sc.ParamHudGui2.Level;
        this.level.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
        this.level.setPos(0, 50);
        this.addChildGui(this.level);
        this.hp = new sc.ParamHudGui2.Param("maxhp", "hp", 62, 9999, 0);
        this.hp.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
        this.hp.setPos(52, 50);
        this.addChildGui(this.hp);
        this.atk = new sc.ParamHudGui2.Param("atk", "attack", 54, 999, 1);
        this.atk.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
        this.atk.setPos(100, 50);
        this.addChildGui(this.atk);
        this.def = new sc.ParamHudGui2.Param("def", "defense", 54, 999, 2);
        this.def.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
        this.def.setPos(140, 50);
        this.addChildGui(this.def);
        this.foc = new sc.ParamHudGui2.Param("foc", "focus", 54, 999, 3);
        this.foc.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP);
        this.foc.setPos(180, 50);
        this.addChildGui(this.foc);
        this.hideParams(true);
        this.doStateTransition("DEFAULT");
    },
    showParams(doTransition) {
        if (doTransition) {
            if (this.hasTransition() || this._isOut) {
                this.doPosTranstition(54, 76, 0.2, KEY_SPLINES.EASE)
            } else {
                this.setPos(54, 76)
            }
        } else {
            if (this.hasTransition() || this._isOut) {
                this.doPosTranstition(52, 5, 0.2, KEY_SPLINES.LINEAR)
            } else {
                this.setPos(52, 5);
            }
        }
        this._isOut = true;
        this.level.doStateTransition("DEFAULT", false, false, null, 0.048);
        this.hp.doStateTransition("DEFAULT", false, false, null, 0.048);
        this.atk.doStateTransition("DEFAULT", false, false, null, 0.048);
        this.def.doStateTransition("DEFAULT", false, false, null, 0.048);
        this.foc.doStateTransition("DEFAULT", false, false, null, 0.048);
    },
    hideParams(isVisible) {
        isVisible = isVisible != void 0 ? isVisible : false;
        this.level.doStateTransition("HIDDEN", isVisible);
        this.hp.doStateTransition("HIDDEN", isVisible);
        this.atk.doStateTransition("HIDDEN", isVisible);
        this.def.doStateTransition("HIDDEN", isVisible);
        this.foc.doStateTransition("HIDDEN", isVisible);
        this._isOut = false;
    }
});
sc.ParamHudGui2.Pie = sc.ParamHudGui.Pie.extend({
    init(param) {
        this.parent(param);
        sc.Model.removeObserver(sc.model.player2, this);
        sc.Model.addObserver(sc.model.player2, this);
    },
    modelChanged(sender, event) {
        if (sender == sc.model.player2) {
            if (event == sc.PLAYER_MSG.ELEMENT_MODE_CHANGE 
                || event == sc.PLAYER_MSG.LEVEL_CHANGE 
                || event == sc.PLAYER_MSG.SKILL_CHANGED) {

                const factor = sc.model.player2.getCurrentElementMode().getParamFactor(this.param);
                if (this._targetValue != factor) {
                    this._timer = 0;
                    this._startValue = this._targetValue;
                    this._targetValue = factor;
                }
            }
        }
    }
});
sc.ParamHudGui2.Param = sc.ParamHudGui.Param.extend({
    init(...args) {
        this.parent(...args);

        sc.Model.removeObserver(sc.model.player.params, this);
        sc.Model.removeObserver(sc.model.player2, this);

        sc.Model.addObserver(sc.model.player2, this);
        sc.Model.addObserver(sc.model.player2.params, this);
    },
    _setNumber(isInvisible) {
        const stat = sc.model.player2.params.getStat(this._param);
        this._number.setNumber(stat, isInvisible);
        const buffFactor = sc.model.player2.params.getStatBuffFactor(this._param);
        let color = sc.GUI_NUMBER_COLOR.WHITE;
        if (buffFactor < 1)
            color = sc.GUI_NUMBER_COLOR.RED;
        if (buffFactor > 1)
            color = sc.GUI_NUMBER_COLOR.GREEN;
        this._number.setColor(color);
    },
    modelChanged(sender, event) {
        if (sender == sc.model.player2) {
            if (event == sc.PLAYER_MSG.ELEMENT_MODE_CHANGE || event == sc.PLAYER_MSG.LEVEL_CHANGE) {
                this._setNumber()
            } else if (event == sc.PLAYER_MSG.EQUIP_CHANGE 
                    || event == sc.PLAYER_MSG.RESET_PLAYER 
                    || event == sc.PLAYER_MSG.CONFIG_CHANGED 
                    || event == sc.PLAYER_MSG.SET_PARAMS 
                    || event == sc.PLAYER_MSG.SKILL_CHANGED) {
                this._setNumber(!this.isVisible())
            }
        } else if (sender == sc.model.player2.params && event == sc.COMBAT_PARAM_MSG.STATS_CHANGED) {
            this._setNumber(!this.isVisible());
        }
    }
});
sc.ParamHudGui2.Level = sc.ParamHudGui.Level.extend({
    init() {
        this.parent();
        sc.Model.removeObserver(sc.model.player2, this);
        sc.Model.addObserver(sc.model.player2, this);
        this._level.setNumber(sc.model.player2.level, true);
    },
    modelChanged(sender, event) {
        if (sender == sc.model.player2) {
            switch (event) {
                case sc.PLAYER_MSG.LEVEL_CHANGE:
                    this._level.setNumber(sc.model.player2.level);
                    break;
                case sc.PLAYER_MSG.SET_PARAMS:
                    this._level.setNumber(sc.model.player2.level, true);
                    break;
            }
        }
    }
});
{
    const elementOffsets = [{
        x: 20,
        y: 20
    }, {
        x: 20,
        y: 44
    }, {
        x: 20,
        y: -4
    }, {
        x: 44,
        y: 20
    }, {
        x: -4,
        y: 20
    }];
    sc.StatusHudGui.inject({
        elementBgGui2: null,
        elementModeGui2: null,
        paramGui2: null,

        init() {
            this.parent();
            this.elementBgGui2 = new sc.StatusElementBgGui2;
            this.elementBgGui2.setPos(3, 53);
            this.addChildGui(this.elementBgGui2);
            this.elementModeGui2 = new sc.StatusElementModeGui2;
            this.elementModeGui2.setPos(0, 50);
            this.addChildGui(this.elementModeGui2);
            this.paramGui2 = new sc.ParamHudGui2;
            this.paramGui2.setPos(54, 76);
            this.addChildGui(this.paramGui2);
            sc.Model.addObserver(sc.model.player2, this);
        },

        modelChanged(sender, event) {
            if (sender == sc.model.player2) {
                if (event == sc.PLAYER_MSG.ELEMENT_MODE_CHANGE)
                    this.elementSwitchDisplay();
                else if (event == sc.PLAYER_MSG.ITEM_CONSUME_START)
                    this.elementSwitchTimer = 100;
                else if (event == sc.PLAYER_MSG.ITEM_CONSUME_END)
                    this.elementSwitchTimer = c ? 1.5 : 1E-4;
            }

            this.parent(sender, event)
        },
        _minimizeDisplay() {
            this.elementModeGui2.doPosTranstition(0, 50, 0.3, KEY_SPLINES.EASE_IN_OUT);
            this.elementModeGui2.selectBg = false;
            this.elementBgGui2.doStateTransition("HIDDEN");
            this.paramGui2.hideParams();

            this.parent();
        },
        _minimizeDisplayFast() {
            this.elementModeGui2.doPosTranstition(0, 50, 0.2, KEY_SPLINES.EASE_IN_OUT);
            this.elementModeGui2.selectBg = false;
            this.elementBgGui2.doStateTransition("HIDDEN_MENU");
            this.paramGui2.hideParams();

            this.parent();
        },
        _enterQuickMenuMode() {
            this.elementBgGui2.doStateTransition("QUICKMENU");
            const curentMode = elementOffsets[sc.model.player2.currentElementMode];
            this.elementModeGui2.doPosTranstition(curentMode.x + 3, curentMode.y + 53, 0.2, KEY_SPLINES.EASE);
            this.elementModeGui2.doStateTransition("QUICKMENU");
            this.elementModeGui2.selectBg = true;
            this.paramGui2.showParams(false);

            this.parent();
        },
        _enterMenuMode() {
            this.elementBgGui2.doStateTransition("MENU");
            const curentMode = elementOffsets[sc.model.player2.currentElementMode];
            this.elementModeGui2.doPosTranstition(curentMode.x + 3 + 2, curentMode.y + 53 + 21, 0.2, KEY_SPLINES.EASE);
            this.elementModeGui2.doStateTransition("MENU");
            this.elementModeGui2.selectBg = true;
            this.paramGui2.showParams(true);

            this.parent();
        },
        elementSwitchDisplay: function () {
            this.elementBgGui2.doStateTransition("DEFAULT");
            const curentMode = elementOffsets[sc.model.player2.currentElementMode];
            this.elementModeGui2.setPos(curentMode.x + 3, curentMode.y + 53);
            this.elementModeGui2.doStateTransition("ZOOM", true);
            this.elementModeGui2.doStateTransition("DEFAULT");
            this.elementModeGui2.selectBg = true;
            this.paramGui2.showParams(false);

            this.parent();
        },
    });
}

sc.StatusUpperGui.inject({
    init() {
        this.parent();
        
        const hp = new sc.HpHudGuiTwo;
        hp.setPos(0, 50);
        this.addChildGui(hp);

        const sp = new sc.SpHudGuiTwo;
        this.addChildGui(sp);
        sp.setPos(55, 50);

        const exp = new sc.ExpHudGuiTwo;
        exp.setPos(63, 58);
        this.addChildGui(exp);
    }
});

sc.StatusElementModeGui2 = sc.StatusElementModeGui.extend({
    updateDrawables(renderer) {
        const original = sc.model.player;
        sc.model.player = sc.model.player2;

        this.parent(renderer);

        sc.model.player = original;
    }
});

sc.StatusElementBgGui2 = sc.StatusElementBgGui.extend({
    updateDrawables(renderer) {
        const original = sc.model.player;
        sc.model.player = sc.model.player2;

        this.parent(renderer);

        sc.model.player = original;
    }
});

sc.ExpMenuGui.inject({
    modelChanged: function (b, a) {
        this.parent(b, a);
        if (b != sc.model && b == sc.menu && (a == sc.MENU_EVENT.ENTER_MENU || a == sc.MENU_EVENT.LEAVE_MENU)) {
            if (b.currentMenu == sc.MENU_SUBMENU.EQUIPMENT_ALT) {
                this.doStateTransition("HIDDEN");
            }
        }
    }
});

sc.ExpMenuGuiTwo = sc.ExpMenuGui.extend({
    init() {
        this.parent();
        sc.Model.removeObserver(sc.model.player, this);
        sc.Model.addObserver(sc.model.player2, this);
        this._expNumber.setNumber(sc.model.player2.exp, true);
    },
    modelChanged(sender, event) {
        if (sender != sc.model && sender == sc.menu && (event == sc.MENU_EVENT.ENTER_MENU || event == sc.MENU_EVENT.LEAVE_MENU)) {
            if (sender.currentMenu == sc.MENU_SUBMENU.EQUIPMENT_ALT) {
                this.doStateTransition("HIDDEN");
            }
        }
    }
});

//TODO: minify this
sc.ExpHudGuiTwo = ig.GuiElementBase.extend({
    baseEntry: null,
    menuEntry: null,
    timer: 0,
    expSum: 0,
    expAddEntries: [],
    init: function () {
        this.parent();
        this.baseEntry = new sc.ExpEntryGui(true);
        this.baseEntry.doStateTransition("HIDDEN", true);
        this.addChildGui(this.baseEntry);
        this.menuEntry = new sc.ExpMenuGuiTwo;
        this.addChildGui(this.menuEntry);
        sc.Model.addObserver(sc.model, this);
        sc.Model.addObserver(sc.model.player2, this);
    },
    update: function () {
        if (this.timer > 0) {
            this.timer = this.timer - ig.system.actualTick;
            if (this.timer <= 0)
                if (this.expAddEntries.length > 0) {
                    this.mergeExpEntry();
                    this.timer = this.expAddEntries.length ? 1 : 5;
                } else {
                    this.expSum = 0;
                    this.baseEntry.doStateTransition("HIDDEN");
                }
        }
    },
    addExp: function (b) {
        if (this.expSum) {
            b = new sc.ExpEntryGui(false, b);
            b.doStateTransition("HIDDEN", true);
            b.doStateTransition("DEFAULT");
            this.expAddEntries.push(b);
            this.insertChildGui(b, Math.max(this.hook.children.length - 2, 0));
            this.timer = 2;
        } else {
            this.expSum = b;
            this.baseEntry.doStateTransition("DEFAULT");
            this.baseEntry.setExp(b);
            this.timer = 5;
        }
        this.expAddEntries.length > 3 ? this.mergeExpEntry() : this.reorder();
    },
    mergeExpEntry: function () {
        var b = this.expAddEntries.shift();
        this.expSum = this.expSum + b.exp;
        this.baseEntry.setExp(this.expSum);
        b.doStateTransition("MERGE", false, true);
        this.reorder();
    },
    mergeAllEntries: function () {
        for (; this.expAddEntries.length >
            0;)
            this.mergeExpEntry();
    },
    reorder: function () {
        for (var b = this.baseEntry.hook.size.x, a = 0; a < this.expAddEntries.length; ++a) {
            b = b + -3;
            this.expAddEntries[a].doPosTranstition(b, 0, 0.3, KEY_SPLINES.EASE_IN_OUT);
            b = b + this.expAddEntries[a].hook.size.x;
        }
    },
    modelChanged: function (b, a, d) {
        if (b == sc.model.player2)
            if (a == sc.PLAYER_MSG.EXP_CHANGE)
                this.addExp(d);
            else {
                if (a == sc.PLAYER_MSG.RESET_PLAYER) {
                    this.mergeAllEntries();
                    this.timer = this.expSum = 0;
                    this.baseEntry.setExp(0);
                    this.menuEntry._expNumber.setNumber(0);
                    this.baseEntry.doStateTransition("HIDDEN");
                }
            }
        else if (b ==
            sc.model && a == sc.GAME_MODEL_MSG.SUB_STATE_CHANGED && b.isMenu()) {
            this.mergeAllEntries();
            this.expSum = 0;
            this.baseEntry.doStateTransition("HIDDEN");
        }
    }
});

sc.BigHpBar.inject({
    _isHpBarVisible: function () {
        if (!ig.vars.get("tmp.playerOppose")) {
            return this.parent();
        }
    },
});

sc.EquipStatusContainer2 = sc.EquipStatusContainer.extend({
    init: replacePlayerModel,
    _setParameters: replacePlayerModel,
    _resetChangeValue: replacePlayerModel,
    _setCurrentValues: replacePlayerModel,
    _setCurrentModifiers: replacePlayerModel,
});

sc.EquipRightContainer2 = sc.EquipRightContainer.extend({
    _equipItem: replacePlayerModel,
    _makeList: replacePlayerModel,
    isIDEquipped: replacePlayerModel,
});
sc.EquipBodyPartContainer2 = sc.EquipBodyPartContainer.extend({
    buttonGroup: null,
    buttons: {
        head: null,
        rightArm: null,
        leftArm: null,
        torso: null,
        feet: null
    },
    init: replacePlayerModel,
});

sc.EquipMenu2 = sc.EquipMenu.extend({
    init: replacePlayerModelIn(function() {
        this.parent();
        
        sc.Model.removeObserver(sc.model.menu, this.rightContainer);
        sc.Model.removeObserver(sc.model.menu, this.rightContainer.partChooser);
        this.removeChildGui(this.rightContainer);
        this.rightContainer = new sc.EquipRightContainer2(this.globalButtons);
        this.addChildGui(this.rightContainer);
    }),
    addObservers: replacePlayerModel,
    removeObservers: replacePlayerModel,
    modelChanged: replacePlayerModel,
});

sc.SpecialSkill.inject({
    getNameAlt: replacePlayerModelIn(function() {
        this.getName();
    }),
    getDescriptionAlt: replacePlayerModelIn(function() {
        this.getDescription();
    }),
});

//TODO: minify this
sc.CrossPointsOverview2 = ig.GuiElementBase.extend({
    gfx: new ig.Image("media/gui/circuit.png"),
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0,
                offsetX: -86
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN_MIN: {
            state: {
                alpha: 0,
                offsetX: -145
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    sizeTransition: null,
    points: [],
    background: null,
    leftButton: null,
    rightButton: null,
    currentElement: -1,
    minimized: false,
    _elementCount: 0,
    init: function () {
        this.parent();
        this.setPos(10, 30);
        this.setSize(132, 100);
        this.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
        this.background = new sc.MenuPanel(sc.MenuPanelType.TOP_RIGHT_EDGE);
        this.background.setSize(76, 100);
        this.background.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
        this.addChildGui(this.background);
        for (var b in sc.ELEMENT) {
            var a = sc.ELEMENT[b];
            this.points[a] = new sc.CrossPointsOverview2.Entry(a);
            this.addChildGui(this.points[a]);
        }
        this.leftButton = new sc.ButtonGui("\\i[arrow-left]", 34, true, sc.BUTTON_TYPE.SMALL);
        this.leftButton.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_OUT
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: -5
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_IN
            }
        };
        this.leftButton.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
        this.leftButton.setPos(5, 0);
        this.leftButton.onButtonPress = this._onHotkeyLeft.bind(this);
        this.rightButton = new sc.ButtonGui("\\i[arrow-right]", 34, true, sc.BUTTON_TYPE.SMALL);
        this.rightButton.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_OUT
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: -5
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_IN
            }
        };
        this.rightButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_BOTTOM);
        this.rightButton.setPos(-20, 0);
        this.rightButton.onButtonPress = this._onHotkeyRight.bind(this);
        this.leftButton.doStateTransition("HIDDEN", true);
        this.rightButton.doStateTransition("HIDDEN", true);
        this.background.annotation = {
            content: {
                title: "sc.gui.menu.help.circuit.titles.points",
                description: "sc.gui.menu.help.circuit.description.points"
            },
            offset: {
                x: 0,
                y: 0
            },
            size: {
                x: "dyn",
                y: "dyn"
            },
            index: {
                x: 0,
                y: 0
            },
            condition: function () {
                return !this.minimized;
            }
                .bind(this)
        };
        this.addChildGui(this.leftButton);
        this.addChildGui(this.rightButton);
        this.doStateTransition("HIDDEN", true);
    },
    update: function () {
        if (this.sizeTransition) {
            this.sizeTransition.timer = this.sizeTransition.timer + ig.system.actualTick;
            var b = Math.min(1, Math.max(0, this.sizeTransition.timer) / this.sizeTransition.time),
                b = this.sizeTransition.timeFunction.get(b);
            this.background.hook.size.x = Math.round(this.sizeTransition.startWidth *
                (1 - b) + this.sizeTransition.width * b);
            this.background.hook.size.y = Math.round(this.sizeTransition.startHeight * (1 - b) + this.sizeTransition.height * b);
            if (b == 1)
                this.sizeTransition = null;
        }
    },
    doSizeTransition: function (b, a, d, c) {
        this.sizeTransition = {
            startWidth: this.background.hook.size.x,
            width: b || 0,
            startHeight: this.background.hook.size.y,
            height: a || 0,
            time: d,
            timeFunction: KEY_SPLINES.EASE,
            timer: 0 - (c || 0)
        };
    },
    _addHotkeys: function () {
        sc.menu.buttonInteract.addGlobalButton(this.leftButton, this._checkHotkey.bind(this));
        sc.menu.buttonInteract.addGlobalButton(this.rightButton,
            this._checkHotkey.bind(this));
    },
    _onHotkeyRight: function () {
        this._circleTree(1);
    },
    _onHotkeyLeft: function () {
        this._circleTree(0);
    },
    _checkHotkey: function () {
        return false;
    },
    _circleTree: function (b) {
        if (b >= 0) {
            b = this._cycleElements(b);
            b != sc.menu.currentSkillTree && sc.menu.selectSkillTree(b);
        }
    },
    _cycleElements: function (b) {
        var a = sc.menu.currentSkillTree;
        do
            if (b > 0)
                a = (a + 1) % 5;
            else {
                a--;
                a < 0 && (a = 4);
            }
        while (!sc.model.player2.hasElement(a));
        return a;
    },
    _selectElement: function (b) {
        if (!(this._elementCount <= 1) && this.currentElement !=
            b) {
            if (this.minimized) {
                this.points[this.currentElement].doStateTransition("HIDDEN", true);
                this.points[b].setPos(42, -2 + (this._elementCount - 1) * 20);
                this.points[b].doStateTransition("DEFAULT", true);
                this.points[b].hideIcon(0, true);
                this.points[b].showIcon(0.2, false, this.currentElement);
            } else
                for (var a = this.points.length; a--;)
                    a != b && this.points[a].doStateTransition("HIDDEN");
            this.currentElement = b;
            this._minimizeOverview(b);
        }
    },
    _minimizeOverview: function (b) {
        if (!this.minimized) {
            this.points[b].doPosTranstition(42,
                -2 + (this._elementCount - 1) * 20, 0.2, KEY_SPLINES.EASE, 0.1);
            this.background.doPosTranstition(13, 0, 0.2, null, 0.2);
            this.doSizeTransition(132, 21, 0.2, 0.1);
            this.leftButton.doStateTransition("DEFAULT", false, false, null, 0.3);
            this.rightButton.doStateTransition("DEFAULT", false, false, null, 0.3);
            this._addHotkeys();
            this.minimized = true;
        }
    },
    _maximizeOverview: function (b) {
        if (this.minimized) {
            this.currentElement = -1;
            b = this._setPositions(false, true, b);
            this.background.doPosTranstition(0, 0, 0.2, null, 0.1);
            this.doSizeTransition(76,
                b, 0.2, 0.1);
            this.leftButton.doStateTransition("HIDDEN");
            this.rightButton.doStateTransition("HIDDEN");
            this.minimized = false;
            this.removeHotkeys();
        }
    },
    _resetOverview: function () {
        this.minimized = false;
        this.currentElement = -1;
        var b = this._setPositions();
        this.hook.size.y = b;
        this.background.setPos(0, 0);
        this.background.setSize(76, b < 20 ? 20 : b);
        this.leftButton.doStateTransition("HIDDEN", true);
        this.rightButton.doStateTransition("HIDDEN", true);
    },
    _setPositions: function (b, a, d) {
        for (var c = -2, e = null, f = sc.model.player2, g = this._elementCount =
            0; g < this.points.length; g++) {
            e = this.points[g];
            if (f.getCore(g + 8)) {
                if (a && d != g) {
                    e.doStateTransition("HIDDEN", true);
                    e.doStateTransition("DEFAULT", false, false, null, 0.3);
                } else
                    e.doStateTransition("DEFAULT", !b);
                this._elementCount++;
            } else
                e.doStateTransition("HIDDEN", !b);
            d == g && a ? e.doPosTranstition(2, c, 0.2, KEY_SPLINES.EASE, 0.1) : e.setPos(2, c);
            f.getCore(g + 8) && (c = c + 20);
        }
        return this._elementCount * 20;
    },
    addObservers: function () {
        sc.Model.addObserver(sc.menu, this);
        sc.Model.addObserver(sc.model.player2, this);
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.model.menu,
            this);
        sc.Model.removeObserver(sc.model.player2, this);
    },
    showMenu: function () {
        this._resetOverview();
        this.doStateTransition("DEFAULT");
    },
    hideMenu: function () {
        this.exitMenu();
    },
    exitMenu: function () {
        this.minimized ? this.doStateTransition("HIDDEN_MIN") : this.doStateTransition("HIDDEN", false, false, function () {
            this._resetOverview();
        }
            .bind(this));
        this.minimized = false;
        this.removeHotkeys();
    },
    removeHotkeys: function () {
        sc.menu.buttonInteract.removeGlobalButton(this.leftButton);
        sc.menu.buttonInteract.removeGlobalButton(this.rightButton);
    },
    modelChanged: function (b, a) {
        if (b == sc.menu)
            a == sc.MENU_EVENT.SKILL_TREE_SELECT && (sc.menu.currentSkillTree < 0 ? this._maximizeOverview(this.currentElement) : this._selectElement(sc.menu.currentSkillTree));
        else if (b == sc.model.player2 && (a == sc.PLAYER_MSG.CP_CHANGE || a == sc.PLAYER_MSG.SKILL_CHANGED))
            for (var d = this.points.length; d--;)
                this.points[d].updatePoints();
    }
});
sc.CrossPointsOverview2.Entry = sc.CrossPointsOverview.Entry.extend({
    init: replacePlayerModel,
    updatePoints: replacePlayerModel,
});

sc.CircuitNodeMenu2 = sc.MenuPanel.extend({
    ninepatch: new ig.NinePatch("media/gui/circuit.png", {
        width: 5,
        height: 5,
        left: 5,
        top: 5,
        right: 5,
        bottom: 5,
        offsets: {
            "top-left": {
                x: 32,
                y: 176
            },
            "top-right": {
                x: 48,
                y: 176
            }
        }
    }),
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                scaleX: 1,
                scaleY: 0
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    activateSound: new ig.Sound("media/sound/menu/circuit/circuit-upgrade-b-2.ogg", 1),
    cost: null,
    costNumber: null,
    costCP: null,
    activate: null,
    cancel: null,
    buttonGroup: null,
    mode: sc.CIRCUIT_NODE_MENU_MODE.ACTIVATE,
    delta: Vec2.createC(-1, -1),
    _scrollHook: null,
    _currentFocusGui: null,
    _maxOrSkillStep: 0,
    _chainMode: false,
    init: function (a) {
        this.parent();
        this.setSize(100, 63);
        this._scrollHook = a;
        this.hook.invisibleUpdate = true;
        this.hook.setMouseRecord(true);
        this.buttonGroup = new sc.ButtonGroup(false, ig.BUTTON_GROUP_SELECT_TYPE.VERTICAL);
        this.cost = new sc.TextGui(ig.lang.get("sc.gui.menu.skill.cost"), {
            speed: ig.TextBlock.SPEED.IMMEDIATE
        });
        this.cost.setPos(6, 2);
        this.addChildGui(this.cost);
        this.costCP = new sc.TextGui("cp", {
            speed: ig.TextBlock.SPEED.IMMEDIATE
        });
        this.costCP.setAlign(ig.GUI_ALIGN.X_RIGHT,
            ig.GUI_ALIGN.Y_TOP);
        this.costCP.setPos(6, 2);
        this.costCP.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.addChildGui(this.costCP);
        this.costNumber = new sc.NumberGui(444, {
            transitionTime: 0,
            size: sc.NUMBER_SIZE.TEXT
        });
        this.costNumber.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
        this.costNumber.setPos(this.costCP.hook.size.x + 6, 6);
        this.costNumber.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.addChildGui(this.costNumber);
        this.activate = new sc.ButtonGui(ig.lang.get("sc.gui.menu.skill.activate"), 96, true, sc.BUTTON_TYPE.ITEM);
        this.activate.setPos(1, 21);
        this.activate.submitSound = null;
        this.activate.onButtonPress = this._onActivatePress.bind(this);
        this.addChildGui(this.activate);
        this.cancel = new sc.ButtonGui(ig.lang.get("sc.gui.menu.skill.cancel"), 96, true, sc.BUTTON_TYPE.ITEM);
        this.cancel.setPos(1, 41);
        this.cancel.onButtonPress =
            this._onCancelPress.bind(this);
        this.addChildGui(this.cancel);
        this.buttonGroup.addFocusGui(this.activate, 0, 0);
        this.buttonGroup.addFocusGui(this.cancel, 0, 1);
        this._addLine(1, 19, 98, 1);
        this._addLine(1, 61, 98, 1);
        this._addLine(98, 20, 1, 7);
        this._addLine(98, 36, 1, 25);
        this.doStateTransition("HIDDEN", true);
    },
    addObservers: function () {
        sc.Model.addObserver(sc.menu, this);
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.menu, this);
    },
    update: function () {
        this._updatePos();
    },
    updateDrawables: function (a) {
        this.parent(a);
        a.addGfx(this.ninepatch.gfx, 99, 26, 32, 148, 12, 13);
    },
    modelChanged: function (a, b, c) {
        a == sc.menu && (b == sc.MENU_EVENT.SKILL_NODE_SELECT ? this._enterNodeMenu(c) : b == sc.MENU_EVENT.SKILL_NODE_EXIT ? this._exitNodeMenu() : b == sc.MENU_EVENT.SKILL_TREE_SELECT && this.hook.currentStateName == "DEFAULT" && this._exitNodeMenu());
    },
    _onActivatePress: function () {
        if (this._currentFocusGui) {
            var a = this._currentFocusGui.branchSkill ? true : false,
                b = this._currentFocusGui,
                c = this._currentFocusGui.parentGui ? this._currentFocusGui.parentGui : null,
                d = this._currentFocusGui.skill.uid;
            sc.skilltree.getSkill(d);
            if (sc.skilltree.skills[d]) {
                if (a) {
                    a = false;
                    b.orLeft ? sc.model.player2.hasSkill(d + 1) && (a = true) : sc.model.player2.hasSkill(d - 1) && (a = true);
                    if (a) {
                        this.activateSound.play();
                        sc.model.player2.switchBranch(d - b.orBranchIndex * 2, b.orLeft);
                        this._showEffectOnBranch(this._currentFocusGui);
                    } else {
                        a = false;
                        b.orBranchIndex > 0 ? c.orLeft ? sc.model.player2.hasSkill(c.skill.uid + 1) && (a = true) : sc.model.player2.hasSkill(c.skill.uid - 1) && (a = true) : a = false;
                        if (sc.model.player2.hasSkillPoints(d))
                            if (a) {
                                this.activateSound.play();
                                sc.model.player2.switchBranch(d - b.orBranchIndex * 2, b.orLeft, d);
                                this._showEffectOnBranch(this._currentFocusGui);
                            } else if (this._chainMode)
                                this._chainActive(this._currentFocusGui);
                            else {
                                this.activateSound.play();
                                sc.model.player2.learnSkill(d);
                                sc.menu.showSkillEffect(this._currentFocusGui, false);
                            }
                    }
                } else if (sc.model.player2.hasSkillPoints(d))
                    if (this._chainMode)
                        this._chainActive(this._currentFocusGui);
                    else {
                        this.activateSound.play();
                        sc.model.player2.learnSkill(d);
                        sc.menu.showSkillEffect(this._currentFocusGui, false);
                    }
                sc.menu.exitNodeMenu();
            } else
                ig.warn("Could not find skill: " +
                    d);
        }
    },
    _showEffectOnBranch: function (a) {
        if (a.orBranchIndex == 0) {
            sc.menu.showSkillEffect(this._currentFocusGui, false);
            sc.menu.showSkillEffect(this._currentFocusGui.nextGui, false);
            sc.menu.showSkillEffect(this._currentFocusGui.nextGui.nextGui, false);
        } else if (a.orBranchIndex == 1) {
            sc.menu.showSkillEffect(this._currentFocusGui.parentGui, false);
            sc.menu.showSkillEffect(this._currentFocusGui, false);
            sc.menu.showSkillEffect(this._currentFocusGui.nextGui, false);
        } else if (a.orBranchIndex == 2) {
            sc.menu.showSkillEffect(this._currentFocusGui.parentGui,
                false);
            sc.menu.showSkillEffect(this._currentFocusGui.parentGui.parentGui, false);
            sc.menu.showSkillEffect(this._currentFocusGui, false);
        }
    },
    _chainActive: function (a) {
        var b = 0.2,
            c = [],
            d = Vec2.createC(0, 0);
        this._collectSkills(a, c, a);
        for (var i = c.length; i--;) {
            var j = c[i];
            j.switch ? sc.model.player2.switchBranch(j.skill.uid - j.gui.orBranchIndex * 2, j.gui.orLeft, j.noNew ? void 0 : j.skill.uid) : sc.model.player2.learnSkill(j.skill.uid);
            j.gui.getNodeFocus(d);
            sc.menu.showSkillEffect(j.gui, false, b);
            b = b + 0.1;
        }
        c = c[c.length - 1];
        sc.menu.centerOnNodeCam(c.gui,
            c.gui.getNodeFocus(), 0.2, function () {
                sc.menu.centerOnNodeCam(a, a.getNodeFocus(), b);
            }
                .bind(this));
        ig.interact.setBlockDelay(b + 0.1);
    },
    _collectSkills: function (a, b, c) {
        var d = a.skill,
            i = sc.model.player2;
        if (!i.hasSkill(d.uid)) {
            if (a.skill) {
                if (a.orGui) {
                    var j = a.orGui;
                    if (i.hasSkill(j.skill.uid)) {
                        if (c.orGui && c.orLeft != j.orLeft) {
                            b.push({
                                gui: a,
                                skill: d,
                                "switch": true,
                                noNew: true
                            });
                            return;
                        }
                        if (j.orBranchIndex == 2)
                            return;
                        if (j.orBranchIndex <= 1) {
                            b[b.length - 1] = {
                                gui: j.nextGui,
                                skill: j.nextGui.skill,
                                "switch": true
                            };
                            j.nextGui.nextGui &&
                                (b[b.length - 2] = {
                                    gui: j.nextGui.nextGui,
                                    skill: j.nextGui.nextGui.skill,
                                    "switch": true
                                });
                            return;
                        }
                    }
                }
                b.push({
                    gui: a,
                    skill: d
                });
            }
            a.parentGui && this._collectSkills(a.parentGui, b, c);
        }
    },
    _setContent: function (a) {
        this._chainMode = a || false;
        var b = this._currentFocusGui.branchSkill ? true : false,
            c = this._currentFocusGui.skill,
            d = c.uid,
            i = this._currentFocusGui.parentGui ? this._currentFocusGui.parentGui : null;
        this.activate.textChild.setText(ig.lang.get("sc.gui.menu.skill.activate"));
        this.activate.setActive(true);
        this.cost.setText(ig.lang.get("sc.gui.menu.skill.cost"));
        this.costCP.doStateTransition("DEFAULT", true);
        this.costNumber.doStateTransition("DEFAULT", true);
        this.costNumber.setColor(0, sc.GUI_NUMBER_COLOR.WHITE);
        this.costNumber.setNumber(0, true);
        this.buttonGroup.setCurrentFocus(0, 0);
        if (sc.model.player2.hasSkill(c.uid)) {
            this.cost.setText(ig.lang.get("sc.gui.menu.skill.activated"));
            this.costCP.doStateTransition("HIDDEN", false);
            this.costNumber.doStateTransition("HIDDEN", false);
            this.activate.setActive(false);
            this.buttonGroup.setCurrentFocus(0, 1);
        } else {
            var j = false;
            if (b) {
                b = false;
                this._currentFocusGui.orLeft ? sc.model.player2.hasSkill(c.uid + 1) && (b = true) : sc.model.player2.hasSkill(c.uid - 1) && (b = true);
                if (b) {
                    this.activate.textChild.setText(ig.lang.get("sc.gui.menu.skill.switch"));
                    this.cost.setText(ig.lang.get("sc.gui.menu.skill.activated"));
                    this.costCP.doStateTransition("HIDDEN", false);
                    this.costNumber.doStateTransition("HIDDEN", false);
                    return;
                }
                this._currentFocusGui.orBranchIndex > 0 && (i.orLeft ? sc.model.player2.hasSkill(i.skill.uid + 1) && (b = true) : sc.model.player2.hasSkill(i.skill.uid -
                    1) && (b = true));
                b && this.activate.textChild.setText(ig.lang.get("sc.gui.menu.skill.switch"));
                !b && a && (j = true);
            } else
                a && (j = true);
            if (j) {
                if (!this._hasParent(i)) {
                    sc.menu.setInfoText(ig.lang.get("sc.gui.menu.skill.chain-des"));
                    a = this._getTotalSkillCost(this._currentFocusGui, 0);
                    this.costNumber.setNumber(a, true);
                    if (sc.model.player2.hasSkillPointsByCp(a, sc.skilltree.getSkill(c.uid).element)) {
                        this.activate.setActive(true);
                        this.activate.textChild.setText(ig.lang.get("sc.gui.menu.skill.chain"));
                        this.costNumber.setColor(sc.GUI_NUMBER_COLOR.GREEN);
                        this.costCP.setText("\\c[2]cp\\c[0]");
                    } else {
                        this.costNumber.setColor(sc.GUI_NUMBER_COLOR.RED);
                        this.activate.setActive(false);
                        this.activate.textChild.setText("\\c[4]" + ig.lang.get("sc.gui.menu.skill.chain") + "\\c[0]");
                        this.buttonGroup.setCurrentFocus(0, 1);
                        this.costCP.setText("\\c[1]cp\\c[0]");
                    }
                    return;
                }
            } else
                this._chainMode = false;
            c = sc.skilltree.getSkill(c.uid);
            if (!a && !this._hasParent(i)) {
                this.activate.setActive(false);
                this.buttonGroup.setCurrentFocus(0, 1);
            }
            this.costNumber.setNumber(c.getCPCost(), true);
            if (sc.model.player2.hasSkillPoints(d)) {
                this.costNumber.setColor(sc.GUI_NUMBER_COLOR.GREEN);
                this.costCP.setText("\\c[2]cp\\c[0]");
            } else {
                this.costNumber.setColor(sc.GUI_NUMBER_COLOR.RED);
                this.activate.setActive(false);
                this.buttonGroup.setCurrentFocus(0, 1);
                this.costCP.setText("\\c[1]cp\\c[0]");
            }
        }
    },
    _getTotalSkillCost: function (a, b) {
        if (!a.skill || sc.model.player2.hasSkill(a.skill.uid) || a.orGui && sc.model.player2.hasSkill(a.orGui.skill.uid))
            return b;
        var c = sc.skilltree.getSkill(a.skill.uid),
            b = b + c.getCPCost();
        return a.parentGui ? this._getTotalSkillCost(a.parentGui, b) : b;
    },
    _onCancelPress: function () {
        sc.menu.exitNodeMenu();
    },
    _enterNodeMenu: function (a) {
        if (this._currentFocusGui = sc.menu.currentSkillFocus) {
            this.doStateTransition("DEFAULT");
            sc.menu.pushBackCallback(this._onBackButtonPress.bind(this));
            this._setContent(a);
            sc.menu.buttonInteract.pushButtonGroup(this.buttonGroup);
        } else
            this._currentFocusGui = null;
    },
    _exitNodeMenu: function () {
        sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
        this._currentFocusGui = null;
        this._chainMode && sc.menu.setInfoText("", true);
        this.doStateTransition("HIDDEN");
        sc.menu.popBackCallback();
    },
    _onBackButtonPress: function () {
        sc.menu.exitNodeMenu();
    },
    _addLine: function (a, b, c, d) {
        c = new ig.ColorGui("#7E7E7E", c, d);
        c.setPos(a, b);
        this.addChildGui(c);
    },
    _updatePos: function () {
        if (sc.menu.currentSkillFocus && this._currentFocusGui) {
            var b = this.hook;
            d.x = b.size.x + 11;
            d.y = b.size.y;
            a.x = sc.menu.skillCursor.x + 6;
            a.y = sc.menu.skillCursor.y + 54;
            a.x = this._currentFocusGui.hook.pos.x + 6 + 15 + this._currentFocusGui.getOffsetX();
            a.y = this._currentFocusGui.hook.pos.y + 54 + 15 + this._currentFocusGui.getOffsetY();
            var b = a.x + Math.floor(this._scrollHook.scroll.x),
                f = a.y + Math.floor(this._scrollHook.scroll.y);
            this.delta.x = -1;
            this.delta.y = -1;
            c.x = b + this.delta.x * (15.5 + d.x / 2) - d.x / 2;
            c.y = f + this.delta.y * (15.5 + d.y / 2) - d.y / 2;
            this.hook.pos.x = Math.ceil(c.x);
            this.hook.pos.y = Math.ceil(c.y);
        }
    },
    _hasParent: function (a) {
        if (a)
            if (a.branchSkill)
                if (a.orBranchIndex == 2) {
                    if (!sc.model.player2.hasSkill(a.skill.uid) && !sc.model.player2.hasSkill(a.skill.uid - 1))
                        return false;
                } else if (a.orLeft) {
                    if (!sc.model.player2.hasSkill(a.skill.uid) && !sc.model.player2.hasSkill(a.skill.uid + 1))
                        return false;
                } else {
                    if (!sc.model.player2.hasSkill(a.skill.uid) &&
                        !sc.model.player2.hasSkill(a.skill.uid - 1))
                        return false;
                }
            else if (!sc.model.player2.hasSkill(a.skill.uid))
                return false;
        return true;
    }
});
{
    var cachedRingMenuPos = [];
    cachedRingMenuPos[sc.CIRCUIT_MENU_DISPLAY_TIME.SHORT] = {
        hideDelay: 0.05,
        midDelay: 0.05,
        showDuration: 0.1,
        hideDuration: 0.1,
        noInterrupt: true
    };
    cachedRingMenuPos[sc.CIRCUIT_MENU_DISPLAY_TIME.LONG] = {
        hideDelay: 0.3,
        midDelay: 0.2,
        showDuration: 0.2,
        hideDuration: 0.2,
        noInterrupt: true
    };
    sc.CircuitInfoBox2 = sc.MenuPanel.extend({
        ninepatch: new ig.NinePatch("media/gui/circuit.png", {
            width: 5,
            height: 5,
            left: 5,
            top: 5,
            right: 5,
            bottom: 5,
            offsets: {
                "top-left": {
                    x: 32,
                    y: 176
                },
                "top-right": {
                    x: 48,
                    y: 176
                }
            }
        }),
        header: null,
        line: null,
        text: null,
        special: null,
        cpCost: null,
        prevMove: Vec2.createC(-1, -1),
        delta: Vec2.createC(-1, -1),
        jumpFromLastSkill: null,
        lastPos: Vec2.createC(0, 0),
        lastPosTimer: 0,
        _scrollHook: null,
        sizeTransition: null,
        FONT_BOX_OPTIONS: null,
        init: function (a) {
            this.parent(sc.MenuPanelType.TOP_RIGHT_EDGE);
            this.FONT_BOX_OPTIONS = [{
                font: sc.fontsystem.tinyFont,
                padding: 0,
                offset: 1
            }, {
                font: sc.fontsystem.smallFont,
                padding: -1,
                offset: 0
            }, {
                font: sc.fontsystem.font,
                padding: -1,
                offset: 0
            }
            ];
            this._scrollHook = a;
            this.header = new sc.TextGui("UberSkill 9000gt", {
                speed: ig.TextBlock.SPEED.IMMEDIATE,
                maxWidth: 170
            });
            this.header.setPos(8, 2);
            this.addChildGui(this.header);
            this.special = new sc.TextGui("Guard Art", {
                speed: ig.TextBlock.SPEED.IMMEDIATE,
                font: sc.fontsystem.tinyFont,
                maxWidth: 170
            });
            this.special.setPos(7, 9);
            this.special.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
            this.addChildGui(this.special);
            this.special.hook.localAlpha = 0;
            this.line = new ig.ColorGui("#FFFFFF", 10, 1);
            this.line.setPos(4, 19);
            this.addChildGui(this.line);
            this.cpCost = new sc.TextGui("Cost: ", {
                font: sc.fontsystem.tinyFont
            });
            this.cpCost.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
            this.addChildGui(this.cpCost);
            a = sc.options.get("circuit-text-size");
            a = this.FONT_BOX_OPTIONS[a] ? a : 0;
            this.text = new sc.TextGui("Unlocks Magic Dagger + 5.\nIncreases text by a third line.", {
                speed: ig.TextBlock.SPEED.IMMEDIATE,
                maxWidth: 170,
                linePadding: this.FONT_BOX_OPTIONS[a].padding,
                font: this.FONT_BOX_OPTIONS[a].font
            });
            this.text.setPos(8, 20 + this.FONT_BOX_OPTIONS[a].offset);
            this.addChildGui(this.text);
            a = cachedRingMenuPos[sc.options.get("circuit-display-time") || 0];
            this.hook.transitions = {
                DEFAULT: {
                    state: {},
                    time: a.showDuration,
                    timeFunction: KEY_SPLINES.LINEAR
                },
                HIDDEN: {
                    state: {
                        scaleX: 1,
                        scaleY: 0,
                        alpha: 0
                    },
                    time: a.hideDuration,
                    timeFunction: KEY_SPLINES.LINEAR
                }
            };
            this.hook.invisibleUpdate = true;
            this.doSizeTransition(true);
            this.setPos(100, 100);
            this.doStateTransition("HIDDEN", true);
        },
        addObservers: function () {
            sc.Model.addObserver(sc.menu, this);
            var a = sc.options.get("circuit-text-size"),
                a = this.FONT_BOX_OPTIONS[a] ? a : 0;
            this.text.setFont(this.FONT_BOX_OPTIONS[a].font, this.FONT_BOX_OPTIONS[a].padding);
            this.text.setPos(8, 20 + this.FONT_BOX_OPTIONS[a].offset);
            a = cachedRingMenuPos[sc.options.get("circuit-display-time") || 0];
            this.hook.transitions = {
                DEFAULT: {
                    state: {},
                    time: a.showDuration,
                    timeFunction: KEY_SPLINES.LINEAR
                },
                HIDDEN: {
                    state: {
                        scaleX: 1,
                        scaleY: 0,
                        alpha: 0
                    },
                    time: a.hideDuration,
                    timeFunction: KEY_SPLINES.LINEAR
                }
            };
            this.doSizeTransition(true);
        },
        removeObservers: function () {
            sc.Model.removeObserver(sc.menu, this);
            this.jumpFromLastSkill = null;
            this.prevMove.x = 0;
        },
        doSizeTransition: function (a) {
            var b;
            b = 30 + (this.text.hook.size.y + 4);
            if (!(186 == this.hook.size.x && b == this.hook.size.y)) {
                this.line.setSize(178, 1);
                this.line.setPos(4, 19);
                this.cpCost.setPos(8, this.text.hook.size.y +
                    24);
                a ? this.setSize(186, b) : this.sizeTransition = {
                    startWidth: this.hook.size.x,
                    width: 186,
                    startHeight: this.hook.size.y,
                    height: b || 0,
                    time: 0.1,
                    timeFunction: KEY_SPLINES.EASE,
                    timer: 0
                };
            }
        },
        update: function () {
            if (sc.menu.skillDrag && !sc.menu.currentSkillFocus) {
                this.doStateTransition("HIDDEN", false, false, function () {
                    this.jumpFromLastSkill = null;
                }
                    .bind(this));
                this.jumpFromLastSkill = null;
            }
            this._updatePos(true);
            this._updateSize();
            if (!this.hook.hasTransition() && this.hook.currentStateName == "HIDDEN") {
                this.jumpFromLastSkill =
                    null;
                this.lastPosTimer = 0;
            }
        },
        modelChanged: function (a, b) {
            if (a == sc.menu)
                if (b == sc.MENU_EVENT.SKILL_CURSOR_FOCUS_NODE) {
                    this._setContent();
                    this.doStateTransition("DEFAULT");
                } else if (b == sc.MENU_EVENT.SKILL_CURSOR_UNFOCUS_NODE)
                    this._hideInfo();
                else if (b == sc.MENU_EVENT.SKILL_TREE_SELECT || b == sc.MENU_EVENT.SKILL_TOGGLED_INPUT_MODE) {
                    this.jumpFromLastSkill = sc.menu.currentSkillFocus = null;
                    this.prevMove.x = 0;
                    this.doStateTransition("HIDDEN", false, false, function () {
                        this.jumpFromLastSkill = null;
                    }
                        .bind(this));
                }
        },
        _updatePos: function (b) {
            if (sc.menu.currentSkillFocus) {
                if (this.jumpFromLastSkill &&
                    this.jumpFromLastSkill != sc.menu.currentSkillFocus) {
                    Vec2.assign(this.lastPos, this.hook.pos);
                    this.lastPosTimer = 0.1;
                }
                this.jumpFromLastSkill = sc.menu.currentSkillFocus;
                var f = this.hook;
                d.x = f.size.x;
                d.y = f.size.y;
                if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                    f = sc.menu.currentSkillFocus;
                    a.x = f.hook.pos.x + 20 + f.getOffsetX();
                    a.y = f.hook.pos.y + 20 + f.getOffsetY();
                } else {
                    a.x = sc.menu.skillCursor.x;
                    a.y = sc.menu.skillCursor.y;
                }
                var f = a.x + Math.ceil(this._scrollHook.scroll.x),
                    g = a.y + Math.ceil(this._scrollHook.scroll.y),
                    h = f - (ig.system.width - d.x - 16),
                    i = h <= 0 ? 1 : -1;
                if (b && this.prevMove.x != 0) {
                    if (sc.menu.skillState == sc.MENU_SKILL_STATE.NODE_MENU)
                        this.prevMove.x = 1;
                    else if (i != this.prevMove.x && Math.abs(h) > 16)
                        this.prevMove.x = i;
                    this.delta.x = this.delta.x * 0.8 + this.prevMove.x * 0.2;
                    this.delta.y = this.delta.y * 0.8 + this.prevMove.y * 0.2;
                } else {
                    this.prevMove.x = this.delta.x = i;
                    this.prevMove.y = this.delta.y = -1;
                }
                c.x = f + this.delta.x * (15.5 + d.x / 2) - d.x / 2;
                c.y = g + this.delta.y * (15.5 + d.y / 2) - d.y / 2;
                c.x = c.x.limit(1, ig.system.width - d.x - 1);
                c.y = c.y.limit(22, ig.system.height -
                    d.y - 22 - (c.x < 192 ? Math.min(30, 192 - c.x) : 0));
                if (this.lastPosTimer > 0) {
                    this.lastPosTimer = this.lastPosTimer - ig.system.actualTick;
                    this.lastPosTimer <= 0 ? this.lastPosTimer = 0 : Vec2.lerp(c, this.lastPos, this.lastPosTimer / 0.1);
                }
                this.hook.pos.x = Math.ceil(c.x);
                this.hook.pos.y = Math.ceil(c.y);
            } else {
                if (this.hook.currentStateName == "HIDDEN" && !this.hook.hasTransition())
                    this.jumpFromLastSkill = null;
                this.prevMove.x = 0;
            }
        },
        _updateSize: function () {
            if (this.sizeTransition) {
                this.sizeTransition.timer = this.sizeTransition.timer + ig.system.actualTick;
                var a = Math.min(1, Math.max(0, this.sizeTransition.timer) / this.sizeTransition.time),
                    a = this.sizeTransition.timeFunction.get(a);
                this.hook.size.x = Math.round(this.sizeTransition.startWidth * (1 - a) + this.sizeTransition.width * a);
                this.hook.size.y = Math.round(this.sizeTransition.startHeight * (1 - a) + this.sizeTransition.height * a);
                if (a == 1)
                    this.sizeTransition = null;
            }
        },
        _setContent: function () {
            var a = sc.menu.currentSkillFocus.skill,
                b = sc.skilltree.getSkill(a.uid);
            if (b.getName().slice(0, 4) == "BS [")
                this.header.setText("UberSkill 9000gt");
            else if (b instanceof sc.SpecialSkill) {
                this.header.setText("\\c[3]" + b.getNameAlt() + "\\c[0]");
                this.special.setText(ig.lang.get("sc.gui.skills.special-types." + b.skillType));
                this.special.hook.localAlpha = 1;
            } else {
                this.header.setText(b.getName());
                this.special.hook.localAlpha = 0;
            }
            if (sc.menu.currentSkillFocus.blocked) {
                var c = "\\c[3]" + sc.inventory.getItemName(sc.menu.currentSkillFocus.blockID) + "\\c[0]",
                    d = ig.lang.get("sc.gui.menu.skill.shade");
                this.text.setText(d.replace("[xyz]", c));
            } else
                this.text.setText(b.getDescription());
            var c = sc.SkillTools.getCPCost(b.element, b.level),
                d = sc.menu.currentSkillFocus,
                i = sc.model.player2;
            if (d.branchSkill) {
                var j = false;
                d.orLeft ? i.hasSkill(b.id + 1) && (j = true) : i.hasSkill(b.id - 1) && (j = true);
                j ? this.cpCost.setText("\\c[3]" + ig.lang.get("sc.gui.menu.skill.swappable") + "\\c[0]") : i.hasSkill(a.uid) ? this.cpCost.setText("\\c[3]" + ig.lang.get("sc.gui.menu.skill.activated") + "\\c[0]") : i.hasSkillPoints(a.uid) ? this.cpCost.setText(ig.lang.get("sc.gui.menu.skill.cost") + " \\c[2]" + c + "cp\\c[0]") : this.cpCost.setText(ig.lang.get("sc.gui.menu.skill.cost") +
                    " \\c[1]" + c + "cp\\c[0]");
            } else
                i.hasSkill(a.uid) ? this.cpCost.setText("\\c[3]" + ig.lang.get("sc.gui.menu.skill.activated") + "\\c[0]") : i.hasSkillPoints(a.uid) ? this.cpCost.setText(ig.lang.get("sc.gui.menu.skill.cost") + " \\c[2]" + c + "cp\\c[0]") : this.cpCost.setText(ig.lang.get("sc.gui.menu.skill.cost") + " \\c[1]" + c + "cp\\c[0]");
            this.doSizeTransition(true);
        },
        _hideInfo: function () {
            var a = cachedRingMenuPos[sc.options.get("circuit-display-time") || 0];
            this.hook.hasTransition() && this.hook.currentStateName != "DEFAULT" ? this.doStateTransition("HIDDEN",
                false, false, function () {
                    this.jumpFromLastSkill = null;
                }
                    .bind(this)) : a.noInterrupt && this.hook.hasTransition() && this.hook.currentStateName == "DEFAULT" ? this.hook.stateCallback = function () {
                        this.doStateTransition("HIDDEN", false, false, function () {
                            this.jumpFromLastSkill = null;
                        }
                            .bind(this), a.midDelay);
                    }
                        .bind(this) : this.doStateTransition("HIDDEN", false, false, function () {
                            this.jumpFromLastSkill = null;
                        }
                            .bind(this), a.hideDelay);
        }
    });
}
sc.CircuitDetailButtonGroup2 = ig.ButtonGroup.extend({
    sounds: {
        focus: new ig.Sound("media/sound/menu/menu-hover.ogg",
            0.9)
    },
    isNonMouseMenuInput: function () {
        return sc.control.elementModeSwitch() || sc.control.menuCircleRight() || sc.control.menuCircleLeft();
    },
    doButtonTraversal: function () {
        if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD && sc.control.menuConfirm() && sc.menu.currentSkillFocus)
            sc.menu.currentSkillFocus.onButtonPress();
        var a = -1;
        sc.control.menuCircleRight() && (a = 1);
        sc.control.menuCircleLeft() && (a = 0);
        if (a >= 0) {
            a = this.cycleElements(a);
            a != sc.menu.currentSkillTree && sc.menu.selectSkillTree(a);
        }
        a = sc.control.elementModeSwitch();
        a !== false && (!a || a == sc.menu.currentSkillTree ? sc.menu.selectSkillTree(sc.ELEMENT.NEUTRAL) : sc.model.player2.hasElement(a) && sc.menu.selectSkillTree(a));
    },
    cycleElements: function (a) {
        var b = sc.menu.currentSkillTree;
        do
            if (a > 0)
                b = (b + 1) % 5;
            else {
                b--;
                b < 0 && (b = 4);
            }
        while (!sc.model.player2.hasElement(b));
        return b;
    }
});

sc.CircuitOverviewMenu2 = ig.GuiElementBase.extend({
    gfx: new ig.Image("media/gui/circuit.png"),
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        SCALE: {
            state: {
                alpha: 0,
                scaleX: 1.5,
                scaleY: 1.5
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    buffers: [],
    elements: [],
    buttons: [],
    buttonGroup: null,
    init: function () {
        this.parent();
        this.hook.size.x = ig.system.width;
        this.hook.size.y = ig.system.height;
        this.hook.pivot.x = Math.floor(ig.system.width / 2);
        this.hook.pivot.y =
            Math.floor(ig.system.height / 2);
        this.buttonGroup = new sc.CircuitMenuButtonGroup;
        this.buttonGroup.addSelectionCallback(function (a) {
            sc.menu.setInfoText(a.data);
        });
        this.buttonGroup.setMouseFocusLostCallback(function () {
            sc.menu.setInfoText("", true);
        });
        this.doStateTransition("DEFAULT", true);
    },
    onAttach: function () {
        this._createTrees();
        for (var a = this.buttons.length; a--;)
            if (ig.vars.get(sc.CIRCUIT_VAR_KEY + "" + a))
                this.buttons[a].focusable = true;
        this.buttonGroup.setButtons(this.buttons[0], this.buttons[1], this.buttons[2],
            this.buttons[3], this.buttons[4]);
    },
    onFirstTimeAnimationDone: function (a) {
        this.buttons[a].focusable = true;
        a == 0 && (ig.input.mouseGuiActive || this.buttonGroup.sounds.focus.play());
    },
    onDetach: function () {
        this.buffers[h.element].release();
        this.buffers[i.element].release();
        this.buffers[j.element].release();
        this.buffers[k.element].release();
        this.buffers[l.element].release();
    },
    modelChanged: function (a, b) {
        if (a == sc.model.player2 && (b == sc.PLAYER_MSG.SKILL_CHANGED || b == sc.PLAYER_MSG.SKILL_BRANCH_SWAP))
            if (sc.menu.currentSkillTree ==
                -1)
                for (var c = this.elements.length; c--;)
                    this.updateBuffer(c);
            else
                this.elements[sc.menu.currentSkillTree].needsUpdate = true;
    },
    addObservers: function () {
        sc.Model.addObserver(sc.model.player2, this);
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.model.player2, this);
    },
    showMenu: function () {
        for (var a = this.elements.length; a--;) {
            this.elements[a].show();
            this.buttons[a].doStateTransition("DEFAULT", false, false, null, 0.1);
        }
        ig.interact.setBlockDelay(0.2);
        sc.menu.buttonInteract.pushButtonGroup(this.buttonGroup);
    },
    exitMenu: function (a) {
        sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
        for (var b = this.elements.length; b--;) {
            this.elements[b].doStateTransition("HIDDEN", a);
            this.buttons[b].doStateTransition("HIDDEN", a);
        }
    },
    enterDetailView: function () {
        this.doStateTransition("SCALE");
    },
    leaveDetailView: function () {
        for (var a = this.elements.length; a--;)
            if (this.elements[a].needsUpdate) {
                this.updateBuffer(a);
                this.elements[a].needsUpdate = false;
            }
        this.doStateTransition("DEFAULT");
        ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD &&
            this.buttonGroup.regainFocusOnKeyboard();
        ig.interact.setBlockDelay(0.2);
    },
    updateAllBuffers: function () {
        for (var a = this.elements.length; a--;)
            this.updateBuffer(a);
    },
    updateBuffer: function (a) {
        this.elements[a].buffer = null;
        this.buffers[a].release();
        switch (a) {
            case sc.ELEMENT.NEUTRAL:
                this.buffers[a] = ig.imageAtlas.getFragment(93, 93, function () {
                    this._preDrawTree(h);
                }
                    .bind(this));
                break;
            case sc.ELEMENT.HEAT:
                this.buffers[a] = ig.imageAtlas.getFragment(149, 127, function () {
                    this._preDrawTree(i);
                }
                    .bind(this));
                break;
            case sc.ELEMENT.COLD:
                this.buffers[a] =
                    ig.imageAtlas.getFragment(149, 127, function () {
                        this._preDrawTree(j);
                    }
                        .bind(this));
                break;
            case sc.ELEMENT.SHOCK:
                this.buffers[a] = ig.imageAtlas.getFragment(127, 149, function () {
                    this._preDrawTree(k);
                }
                    .bind(this));
                break;
            case sc.ELEMENT.WAVE:
                this.buffers[a] = ig.imageAtlas.getFragment(127, 149, function () {
                    this._preDrawTree(l);
                }
                    .bind(this));
        }
        this.elements[a].buffer = this.buffers[a];
    },
    _createTrees: function () {
        var a = h.element,
            b = i.element,
            c = j.element,
            d = k.element,
            e = l.element;
        this.buffers[a] = ig.imageAtlas.getFragment(93, 93,
            function () {
                this._preDrawTree(h);
            }
                .bind(this));
        this.buffers[b] = ig.imageAtlas.getFragment(149, 127, function () {
            this._preDrawTree(i);
        }
            .bind(this));
        this.buffers[c] = ig.imageAtlas.getFragment(149, 127, function () {
            this._preDrawTree(j);
        }
            .bind(this));
        this.buffers[d] = ig.imageAtlas.getFragment(127, 149, function () {
            this._preDrawTree(k);
        }
            .bind(this));
        this.buffers[e] = ig.imageAtlas.getFragment(127, 149, function () {
            this._preDrawTree(l);
        }
            .bind(this));
        var f = this._updateBufferFromFirstTime.bind(this),
            g = this.onFirstTimeAnimationDone.bind(this);
        this.elements[a] = new sc.CircuitOverviewMenu2.Tree(0, 0, this.buffers[a], a, f, g);
        this.elements[b] = new sc.CircuitOverviewMenu2.Tree(0, 86, this.buffers[b], b, f, g);
        this.elements[c] = new sc.CircuitOverviewMenu2.Tree(0, -86, this.buffers[c], c, f, g);
        this.elements[d] = new sc.CircuitOverviewMenu2.Tree(86, 0, this.buffers[d], d, f, g);
        this.elements[e] = new sc.CircuitOverviewMenu2.Tree(-86, 0, this.buffers[e], e, f, g);
        this.addChildGui(this.elements[a]);
        this.addChildGui(this.elements[b]);
        this.addChildGui(this.elements[c]);
        this.addChildGui(this.elements[d]);
        this.addChildGui(this.elements[e]);
        this.buttons[a] = new sc.CircuitOverviewMenu2.FocusOverlay(0, 0, this.buffers[a], a);
        this.buttons[b] = new sc.CircuitOverviewMenu2.FocusOverlay(0, 86, this.buffers[b], b);
        this.buttons[c] = new sc.CircuitOverviewMenu2.FocusOverlay(0, -86, this.buffers[c], c);
        this.buttons[d] = new sc.CircuitOverviewMenu2.FocusOverlay(86, 0, this.buffers[d], d);
        this.buttons[e] = new sc.CircuitOverviewMenu2.FocusOverlay(-86, 0, this.buffers[e], e);
        this.addChildGui(this.buttons[a]);
        this.addChildGui(this.buttons[b]);
        this.addChildGui(this.buttons[c]);
        this.addChildGui(this.buttons[d]);
        this.addChildGui(this.buttons[e]);
    },
    _updateBufferFromFirstTime: function (a) {
        this.updateBuffer(a);
    },
    _preDrawTree: function (a) {
        var b = a.panels.length,
            c = 80 + 48 * a.element;
        if (a.rotation != void 0)
            if (a.rotation != 0) {
                ig.system.context.save();
                ig.system.context.rotate(a.rotation);
                this.gfx.draw(a.base.x, a.base.y, 65, 160, 127, 149);
                ig.system.context.restore();
            } else
                a.element == 0 ? this.gfx.draw(a.base.x, a.base.y, 392, 368, 93, 93) : this.gfx.draw(a.base.x, a.base.y,
                    65, 160, 127, 149);
        if (sc.model.player2.getCore(a.element + 8) && ig.vars.get(sc.CIRCUIT_VAR_KEY + a.element) && sc.model.player2.hasElement(a.element)) {
            for (; b--;) {
                this.gfx.draw(a.panels[b].x, a.panels[b].y, c, 112, 46, 46);
                sc.menu.skillState == sc.MENU_SKILL_STATE.SWAP_BRANCHES && this.gfx.draw(a.panels[b].x, a.panels[b].y, 224 + a.element * 48, 320, 45, 45);
            }
            this.gfx.draw(a.node.x, a.node.y, a.element * 8, 304, 5, 5);
            this._preDrawTreeNodes(a.element, a.node.x + 2, a.node.y + 2, a.startDir.x, a.startDir.y);
        }
    },
    _preDrawTreeNodes: function (a, c, e, f,
        g) {
        var h = sc.skilltree.getTree(a);
        d.x = c;
        d.y = e;
        cachedRingMenuPos.x = f;
        cachedRingMenuPos.y = g;
        for (var i = null, j = 0; j < h.length; j++) {
            i = h[j];
            if (!this.isEmpty(i)) {
                this._drawLine(d.x, d.y, f, g, i, a);
                this._preDrawTreeRecursive(a, i, c, e, cachedRingMenuPos.x, cachedRingMenuPos.y);
            }
            this._rotate("CW_90", f, g);
            f = cachedRingMenuPos.x;
            g = cachedRingMenuPos.y;
        }
    },
    _preDrawTreeRecursive: function (d, e, f, g, h, i) {
        var j = false;
        if (e.orBranch) {
            var k = e.orBranch;
            this._rotate(e.direction, h, i);
            j = Math.abs(cachedRingMenuPos.x) == 1 && Math.abs(cachedRingMenuPos.y) == 1;
            f = f + ((j ? 4 : 5) + e.distance) * cachedRingMenuPos.x;
            g = g + ((j ? 2 : 5) + e.distance) * cachedRingMenuPos.y;
            a.x = cachedRingMenuPos.x;
            a.y = cachedRingMenuPos.y;
            this._rotate(k.direction, cachedRingMenuPos.x, cachedRingMenuPos.y);
            if (j)
                if (a.x <
                    0 && cachedRingMenuPos.x == 0) {
                    f = f + 2;
                    g = g + (cachedRingMenuPos.y > 0 ? 2 : -2);
                } else if (a.x > 0 && cachedRingMenuPos.x == 0) {
                    f = f - 2;
                    g = g + (cachedRingMenuPos.y > 0 ? 2 : -2);
                }
            (j = Math.abs(cachedRingMenuPos.x) == 1 && Math.abs(cachedRingMenuPos.y) == 1) && ig.error("orBranch can't be rendered with a slope direction.");
            this._drawOrBranchConnection(f, g, cachedRingMenuPos, d, false, k);
            f = f + (j ? 3 : 4) * cachedRingMenuPos.x;
            g = g + (j ? 3 : 4) * cachedRingMenuPos.y;
            for (h = 0; h < 3; h++) {
                c.x = 0 + d * 8;
                c.y = 256 + (sc.model.player2.hasSkill(k.left[h].uid) ? 8 : 0);
                cachedRingMenuPos.x != 0 ? this.gfx.draw(f - 2, g - 2 + (cachedRingMenuPos.x > 0 ? -3 : 3), c.x, c.y, 5, 5) : this.gfx.draw(f - 2 + (cachedRingMenuPos.y < 0 ? -3 : 3), g - 2, c.x, c.y, 5, 5);
                c.y = 256 + (sc.model.player2.hasSkill(k.right[h].uid) ? 8 : 0);
                cachedRingMenuPos.x !=
                    0 ? this.gfx.draw(f - 2, g - 2 + (cachedRingMenuPos.x > 0 ? 3 : -3), c.x, c.y, 5, 5) : this.gfx.draw(f - 2 + (cachedRingMenuPos.y < 0 ? 3 : -3), g - 2, c.x, c.y, 5, 5);
                f = f + (j ? 3 : 5) * cachedRingMenuPos.x;
                g = g + (j ? 3 : 5) * cachedRingMenuPos.y;
            }
            this._drawOrBranchConnection(f, g, cachedRingMenuPos, d, true, k, e);
            f = f - cachedRingMenuPos.x;
            g = g - cachedRingMenuPos.y;
        } else {
            this._rotate(e.direction, h, i);
            j = Math.abs(cachedRingMenuPos.x) == 1 && Math.abs(cachedRingMenuPos.y) == 1;
            f = f + ((j ? 3 : 5) + e.distance) * cachedRingMenuPos.x;
            g = g + ((j ? 3 : 5) + e.distance) * cachedRingMenuPos.y;
            c.x = 0 + d * 8;
            c.y = 256 + (sc.model.player2.hasSkill(e.uid) ? 8 : 0);
            this.gfx.draw(f - Math.floor(2.5), g - Math.floor(2.5), c.x, c.y, 5, 5);
        }
        e = e.children;
        if (e.length != 0) {
            j = null;
            h = cachedRingMenuPos.x;
            i = cachedRingMenuPos.y;
            for (k = 0; k < e.length; k++) {
                j =
                    e[k];
                if (!this.isEmpty(j)) {
                    this._drawLine(f, g, h, i, j, d);
                    this._preDrawTreeRecursive(d, j, f, g, h, i);
                }
            }
        }
    },
    _drawLine: function (a, d, f, g, h, i) {
        if (!(h.distance <= 0)) {
            var j = false,
                j = h.orBranch ? sc.model.player2.hasSkill(h.orBranch.left[0].uid) || sc.model.player2.hasSkill(h.orBranch.right[0].uid) ? true : false : sc.model.player2.hasSkill(h.uid) ? true : false;
            this._rotate(h.direction, f, g);
            f = this._getDrawingDirection(cachedRingMenuPos);
            g = ig.system.context;
            h = h.distance;
            if (f == sc.LINE_DRAW_TYPE.HORZ) {
                c.x = i * 8;
                c.y = j ? 276 : 272;
                this._drawLineStraightLine(cachedRingMenuPos.x >
                    0 ? a + 3 : a - 2 - (8 - (8 - h)), d, h);
            } else {
                if (f == sc.LINE_DRAW_TYPE.VERT) {
                    c.x = i * 8;
                    c.y = j ? 276 : 272;
                    g.save();
                    g.translate((a + (cachedRingMenuPos.y > 0 ? 1 : 0)) * ig.system.scale, (d + (cachedRingMenuPos.y > 0 ? 3 : -2)) * ig.system.scale);
                    g.rotate(cachedRingMenuPos.y > 0 ? e : -e);
                    this._drawLineStraightLine(0, 0, h);
                } else {
                    c.x = i * 8;
                    c.y = j ? 288 : 280;
                    g.save();
                    g.translate(a * ig.system.scale, d * ig.system.scale);
                    g.scale(cachedRingMenuPos.x < 0 ? -1 : 1, cachedRingMenuPos.y < 0 ? -1 : 1);
                    this.gfx.draw(cachedRingMenuPos.x < 0 ? 1 : 2, cachedRingMenuPos.y < 0 ? 1 : 2, c.x, c.y, h, h);
                }
                g.restore();
            }
        }
    },
    _drawLineStraightLine: function (a, b, d) {
        if (d <= 8)
            this.gfx.draw(a, b, c.x, c.y, d, 1);
        else
            for (var e = Math.ceil(d /
                8), f = 8; e--;) {
                d < 8 && (f = d);
                this.gfx.draw(a, b, c.x, c.y, f, 1);
                a = a + 8;
                d = Math.max(0, d - 8);
            }
    },
    _drawOrBranchConnection: function (a, b, c, d, e, f, g) {
        var h = sc.model.player2,
            i = h.hasSkill(f.left[0].uid),
            j = h.hasSkill(f.right[0].uid),
            k = i || j;
        if (c.x < 0 || c.y < 0)
            if (j) {
                i = true;
                j = false;
            } else if (i) {
                j = true;
                i = false;
            }
        var m = false;
        j && !i && (m = true);
        var l = e;
        if (c.x < 0 || c.y < 0)
            l = !l;
        if (e) {
            h.hasSkill(f.left[2].uid);
            h.hasSkill(f.right[2].uid);
            if (g.children[0].orBranch) {
                i = h.hasSkill(g.children[0].orBranch.left[0].uid);
                j = h.hasSkill(g.children[0].orBranch.right[0].uid);
                k = i || j;
            } else
                k = h.hasSkill(g.children[0].uid);
        }
        c.x != 0 ? this.gfx.draw(a - (c.x < 0 ? 1 : 2), b - 3, d * 8 + (k ? 4 : 0), 296, 4, 7, l, m) : c.y != 0 && this.gfx.draw(a - 3, b - (c.y < 0 ? 1 : 2), 48, 256 + (d * 8 + (k ? 4 : 0)), 7, 4, m, l);
    },
    _rotate: function (a, c, d) {
        cachedRingMenuPos.x = c;
        cachedRingMenuPos.y = d;
        switch (sc.SKILLS_DIRECTION[a]) {
            case sc.SKILLS_DIRECTION.CW_45:
                Vec2.rotate(cachedRingMenuPos, -f);
                cachedRingMenuPos.x = Math.round(cachedRingMenuPos.x);
                cachedRingMenuPos.y = Math.round(cachedRingMenuPos.y);
                break;
            case sc.SKILLS_DIRECTION.CCW_45:
                Vec2.rotate(cachedRingMenuPos, f);
                cachedRingMenuPos.x = Math.round(cachedRingMenuPos.x);
                cachedRingMenuPos.y = Math.round(cachedRingMenuPos.y);
                break;
            case sc.SKILLS_DIRECTION.CW_90:
                Vec2.rotate90CCW(cachedRingMenuPos);
                break;
            case sc.SKILLS_DIRECTION.CCW_90:
                Vec2.rotate90CW(cachedRingMenuPos);
                break;
            case sc.SKILLS_DIRECTION.CW_135:
                Vec2.rotate(cachedRingMenuPos, -g);
                cachedRingMenuPos.x = Math.round(cachedRingMenuPos.x);
                cachedRingMenuPos.y = Math.round(cachedRingMenuPos.y);
                break;
            case sc.SKILLS_DIRECTION.CCW_135:
                Vec2.rotate(cachedRingMenuPos, g);
                cachedRingMenuPos.x = Math.round(cachedRingMenuPos.x);
                cachedRingMenuPos.y = Math.round(cachedRingMenuPos.y);
        }
        return cachedRingMenuPos;
    },
    _getDrawingDirection: function (a) {
        if (a.x == 0 && a.y == 0) {
            ig.error("Can't get cardinal direction when x and y are zero! Direction: [x: %i, y: %i]", a.x, a.y);
            return -1;
        }
        if (a.x >= 0) {
            if (a.y < 0 && a.x == 0 || a.y > 0 && a.x == 0)
                return sc.LINE_DRAW_TYPE.VERT;
            if (a.y == 0 && a.x > 0)
                return sc.LINE_DRAW_TYPE.HORZ;
            if (a.y < 0 && a.x > 0 || a.y >
                0 && a.x > 0)
                return sc.LINE_DRAW_TYPE.SLOPE;
        } else {
            if (a.y == 0 && a.x < 0)
                return sc.LINE_DRAW_TYPE.HORZ;
            if (a.y < 0 && a.x < 0 || a.y > 0 && a.x < 0)
                return sc.LINE_DRAW_TYPE.SLOPE;
        }
        return "If this return, you broke something horribly Bro.";
    },
    isEmpty: function (a) {
        for (var b in a)
            return false;
        return true;
    }
});

sc.CircuitOverviewMenu2.Tree = ig.GuiElementBase.extend({
    gfx: new ig.Image("media/gui/circuit.png"),
    buffer: null,
    element: 0,
    needsUpdate: false,
    overlay: null,
    updater: null,
    done: null,
    _timer: 0,
    _alpha: 0,
    _firstTime: false,
    init: function (a, b, c, d, e, f) {
        this.parent();
        this.setSize(c.width, c.height);
        this.setPivot(c.width / 2, c.height / 2);
        this.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);
        this.buffer = c;
        this.element = d || 0;
        this.updater = e || null;
        this.done = f || null;
        this.hook.transitions = {
            DEFAULT: {
                state: {
                    offsetX: a,
                    offsetY: b
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_OUT
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: a + (a ? a > 0 ? 15 : -15 : 0),
                    offsetY: b + (b ? b > 0 ? 15 : -15 : 0)
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.doStateTransition("HIDDEN", true);
    },
    updateDrawables: function (a) {
        this.buffer && a.addGfx(this.buffer, 0, 0, 0, 0);
        if (this._timer > 0) {
            this._timer = this._timer - ig.system.tick;
            if (this._timer <= 0) {
                this._timer = 0;
                this.done && this.done(this.element);
            } else if (this._timer <= 1 && !ig.vars.get(sc.CIRCUIT_VAR_KEY + this.element) && !this._firstTime) {
                ig.vars.set("menu.circuit.start." +
                    this.element, true);
                this.updater(this.element);
                this._firstTime = true;
            }
            var b = (this._timer / 2).limit(0, 1);
            this._alpha = this._timer > 1 ? 2 - KEY_SPLINES.LINEAR.get(b * 2) : KEY_SPLINES.LINEAR.get(b * 2);
            b = o[this.element];
            b.rot && a.addTransform().setPivot(this.buffer.width / 2, this.buffer.height / 2).setRotate(b.rot);
            a.addGfx(this.gfx, b.x, b.y, b.sx, b.sy, b.w, b.h).setAlpha(this._alpha);
            b.rot && a.undoTransform();
        }
    },
    show: function () {
        this.doStateTransition("DEFAULT", false, false, function () {
            if (sc.model.player2.getCore(this.element + 8) &&
                !ig.vars.get(sc.CIRCUIT_VAR_KEY + this.element)) {
                ig.interact.setBlockDelay(2);
                this._timer = 2;
            }
        }
            .bind(this), 0.1);
    }
});

sc.CircuitOverviewMenu2.FocusOverlay = ig.FocusGui.extend({
    gfx: new ig.Image("media/gui/circuit.png"),
    rotation: 0,
    neutral: false,
    piv: Vec2.createC(0, 0),
    points: [],
    element: 0,
    submitSound: null,
    focusable: false,
    init: function (a,
        b, c, d) {
        this.parent();
        this.setSize(c.width, c.height);
        this.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);
        this.element = d;
        this.submitSound = sc.BUTTON_SOUND.submit;
        this.hook.transitions = {
            DEFAULT: {
                state: {
                    offsetX: a,
                    offsetY: b
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE_OUT
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: a + (a ? a > 0 ? 15 : -15 : 0),
                    offsetY: b + (b ? b > 0 ? 15 : -15 : 0)
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        switch (this.element) {
            case sc.ELEMENT.NEUTRAL:
                this.points = m;
                break;
            case sc.ELEMENT.HEAT:
                this.points = n;
                this.rotation =
                    e;
                this.piv.y = -c.width || 0;
                break;
            case sc.ELEMENT.COLD:
                this.points = p;
                this.rotation = -e;
                this.piv.x = -c.height || 0;
                break;
            case sc.ELEMENT.SHOCK:
                this.points = r;
                break;
            case sc.ELEMENT.WAVE:
                this.points = t;
                this.rotation = -Math.PI;
                this.piv.y = -c.height || 0;
                this.piv.x = -c.width || 0;
        }
        this.doStateTransition("HIDDEN", true);
    },
    onButtonPress: function () {
        if (this.focusable) {
            this.submitSound && this.submitSound.play();
            sc.menu.selectSkillTree(this.element);
        }
    },
    updateDrawables: function (a) {
        if (sc.menu.skillState != sc.MENU_SKILL_STATE.SWAP_BRANCHES &&
            (!ig.interact.isBlocked() && this.focusable) && this.focus)
            if (this.element != sc.ELEMENT.NEUTRAL) {
                a.addTransform().setRotate(this.rotation);
                a.addGfx(this.gfx, -3 + this.piv.x, 2 + this.piv.y, 192, 160, 122, 145);
                a.undoTransform();
            } else
                a.addGfx(this.gfx, -3, -3, 320, 168, 99, 99);
    },
    canPlayFocusSounds: function () {
        return !ig.interact.isBlocked() || this.focusable;
    },
    isMouseOver: function () {
        if (!this.focusable || ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD)
            return false;
        for (var a = Math.floor(this.hook.screenCoords.x), b = Math.floor(this.hook.screenCoords.y),
            c = Math.floor(sc.control.getMouseX()), d = Math.floor(sc.control.getMouseY()), e = this.points.length; e--;)
            if (Math.abs(c - (this.points[e].x + a)) + Math.abs(d - (this.points[e].y + b)) <= 45)
                return true;
        return false;
    }
});

{
    function b(a, b, c) {
        if (b <= 1)
            return false;
        if (sc.newgame.get("remove-skill-blocks"))
            return 0;
        for (var c = m[c].shadeBlock,
            d = c.ids, e = d.length; e--;)
            if (a == d[e] && !sc.model.player.hasItem(c.levels[b - 2]))
                return c.levels[b - 2];
        return 0;
    }
    function a(a, b, f, g, h, i, j, k, m, l, o, r) {
        var u = f && sc.model.player2.hasSkill(f.uid),
            y = null,
            L = false;
        if (!l) {
            q.x = 32;
            q.y = 0;
            s.x = h;
            s.y = i;
            v.x = 8;
            v.y = 8;
            t.x = 0;
            t.y = 0;
            n.x = -j;
            n.y = -k;
            c(n, l, u, true, m);
            q.x = o >= 0 ? q.x + Math.max(0, r[o] - 1) * 8 : q.x + Math.max(0, f.level - 1) * 8;
            a.addGfx(b, s.x, s.y, q.x, q.y, v.x, v.y);
        }
        if (g && g.length != 0) {
            n.x = j;
            n.y = k;
            for (f = 0; f < g.length; f++) {
                y = g[f];
                L = y.orBranch ? sc.model.player2.hasSkill(y.orBranch.left[0].uid) ||
                    sc.model.player2.hasSkill(y.orBranch.right[0].uid) ? true : false : sc.model.player2.hasSkill(y.uid) ? true : false;
                q.x = 32;
                q.y = 0;
                s.x = h;
                s.y = i;
                v.x = 8;
                v.y = 8;
                t.x = 0;
                t.y = 0;
                if (!l) {
                    n.x = j;
                    n.y = k;
                    e(y.direction, n.x, n.y);
                }
                c(n, l, u, L, m);
                q.x = o >= 0 ? o + 1 >= 3 ? y.orBranch ? q.x + Math.max(0, y.orBranch.levels[0] - 1) * 8 : q.x + Math.max(0, y.level - 1) * 8 : q.x + Math.max(0, r[o + 1] - 1) * 8 : y.orBranch ? q.x + Math.max(0, y.orBranch.levels[0] - 1) * 8 : q.x + Math.max(0, y.level - 1) * 8;
                a.addGfx(b, s.x, s.y, q.x, q.y, v.x, v.y);
                if (l) {
                    Vec2.assign(p, n);
                    d(a, b, y, m, s.x + t.x, s.y + t.y, n.x, n.y,
                        1, true);
                    Vec2.assign(n, p);
                    e("CW_90", n.x, n.y);
                }
            }
        }
    }
    function d(a, b, c, d, f, h, i, j, k, m, l) {
        var o = 0,
            o = l ? k : (k != void 0 ? k : c.distance) * 8;
        if (!(o <= 0)) {
            n.x = i;
            n.y = j;
            var p = c.orBranch ? true : false,
                l = false,
                l = p ? sc.model.player2.hasSkill(c.orBranch.left[0].uid) || sc.model.player2.hasSkill(c.orBranch.right[0].uid) ? true : false : sc.model.player2.hasSkill(c.uid) ? true : false,
                k = 0,
                k = p ? c.orBranch.levels[0] : c.level || 0,
                k = Math.max(0, k - 1) * 16;
            m && e(c.direction, i, j);
            switch (g(n)) {
                case sc.LINE_DRAW_TYPE.HORZ:
                    if (o <= 16)
                        a.addGfx(b, f, h, (l ? 80 + d * 48 : 32) +
                            k, 80, o, 8);
                    else {
                        c = Math.ceil(o / 16);
                        for (i = 16; c--;) {
                            o < 16 && (i = o);
                            a.addGfx(b, f, h, (l ? 80 + d * 48 : 32) + k, 80, i, 8);
                            f = f + 16;
                            o = Math.max(0, o - 16);
                        }
                    }
                    break;
                case sc.LINE_DRAW_TYPE.VERT:
                    if (o <= 16)
                        a.addGfx(b, f, h, l ? 177 + d * 8 : 169, 312 + k, 8, o);
                    else {
                        c = Math.ceil(o / 16);
                        for (i = 16; c--;) {
                            o < 16 && (i = o);
                            a.addGfx(b, f, h, l ? 177 + d * 8 : 169, 312 + k, 8, i);
                            h = h + 16;
                            o = Math.max(0, o - 16);
                        }
                    }
                    break;
                case sc.LINE_DRAW_TYPE.SLOPE:
                    c = l;
                    i = n.x;
                    j = n.y;
                    m = false;
                    if (i > 0 && j < 0 || i < 0 && j > 0) {
                        m = true;
                        h = h + (o - 16 + 1);
                    } else
                        h = h + 1;
                    n.x = i;
                    n.y = j;
                    i = Math.ceil(o / 16);
                    for (j = 16; i--;) {
                        o < 16 && (j = o);
                        a.addGfx(b,
                            f, h - 3, (c ? 80 + d * 48 : 32) + k, 88, j, 24, m);
                        f = f + 16;
                        o = Math.max(0, o - 16);
                        h = h + (m ? - (o < 16 ? o : 16) : 16);
                    }
            }
        }
    }
    function c(a, b, c, d, e) {
        if (b || c) {
            q.x = d ? 80 : 104;
            q.x = q.x + e * 48;
        } else
            q.x = 32;
        switch (f(a)) {
            case sc.TREE_CARDINAL_DIR.NORTH:
                q.y = 0;
                v.y = 8;
                s.x = s.x - 3;
                s.y = s.y - (b ? 11 : 19);
                t.y = -8;
                break;
            case sc.TREE_CARDINAL_DIR.EAST:
                q.y = 8;
                v.y = 8;
                s.x = s.x + (b ? 5 : 13);
                s.y = s.y - 3;
                t.x = 8;
                break;
            case sc.TREE_CARDINAL_DIR.SOUTH:
                q.y = 16;
                v.y = 8;
                s.x = s.x - 3;
                s.y = s.y + (b ? 5 : 13);
                t.y = t.y + 8;
                break;
            case sc.TREE_CARDINAL_DIR.WEST:
                q.y = 24;
                v.y = 8;
                s.x = s.x - (b ? 11 : 19);
                s.y = s.y - 3;
                t.x = -8;
                break;
            case sc.TREE_CARDINAL_DIR.NORTH_EAST:
                q.y = 32;
                v.y = 12;
                s.x = 25;
                s.y = 4;
                break;
            case sc.TREE_CARDINAL_DIR.SOUTH_EAST:
                q.y = 44;
                v.y = 12;
                s.x = 25;
                s.y = 25;
                break;
            case sc.TREE_CARDINAL_DIR.SOUTH_WEST:
                q.y = 56;
                v.y = 12;
                s.x = 9;
                s.y = 25;
                break;
            case sc.TREE_CARDINAL_DIR.NORTH_WEST:
                q.y = 68;
                v.y = 12;
                s.x = 9;
                s.y = 5;
        }
    }
    function e(a, b, c) {
        n.x = b;
        n.y = c;
        switch (sc.SKILLS_DIRECTION[a]) {
            case sc.SKILLS_DIRECTION.CW_45:
                Vec2.rotate(n, -j);
                n.x = Math.round(n.x);
                n.y = Math.round(n.y);
                break;
            case sc.SKILLS_DIRECTION.CCW_45:
                Vec2.rotate(n, j);
                n.x = Math.round(n.x);
                n.y = Math.round(n.y);
                break;
            case sc.SKILLS_DIRECTION.CW_90:
                Vec2.rotate90CCW(n);
                break;
            case sc.SKILLS_DIRECTION.CCW_90:
                Vec2.rotate90CW(n);
                break;
            case sc.SKILLS_DIRECTION.CW_135:
                Vec2.rotate(n, -k);
                n.x = Math.round(n.x);
                n.y = Math.round(n.y);
                break;
            case sc.SKILLS_DIRECTION.CCW_135:
                Vec2.rotate(n, k);
                n.x = Math.round(n.x);
                n.y = Math.round(n.y);
        }
        return n;
    }
    function f(a) {
        if (a.x >= 0) {
            if (a.y < 0 && a.x == 0)
                return sc.TREE_CARDINAL_DIR.NORTH;
            if (a.y > 0 && a.x == 0)
                return sc.TREE_CARDINAL_DIR.SOUTH;
            if (a.y == 0 && a.x > 0)
                return sc.TREE_CARDINAL_DIR.EAST;
            if (a.y < 0 && a.x > 0)
                return sc.TREE_CARDINAL_DIR.NORTH_EAST;
            if (a.y > 0 && a.x > 0)
                return sc.TREE_CARDINAL_DIR.SOUTH_EAST;
        } else {
            if (a.y == 0 && a.x < 0)
                return sc.TREE_CARDINAL_DIR.WEST;
            if (a.y < 0 && a.x < 0)
                return sc.TREE_CARDINAL_DIR.NORTH_WEST;
            if (a.y > 0 && a.x < 0)
                return sc.TREE_CARDINAL_DIR.SOUTH_WEST;
        }
        return null;
    }
    function g(a) {
        if (a.x >= 0) {
            if (a.y < 0 && a.x == 0 || a.y > 0 && a.x == 0)
                return sc.LINE_DRAW_TYPE.VERT;
            if (a.y == 0 && a.x > 0)
                return sc.LINE_DRAW_TYPE.HORZ;
            if (a.y < 0 && a.x > 0 || a.y > 0 && a.x > 0)
                return sc.LINE_DRAW_TYPE.SLOPE;
        } else {
            if (a.y == 0 && a.x <
                0)
                return sc.LINE_DRAW_TYPE.HORZ;
            if (a.y < 0 && a.x < 0 || a.y > 0 && a.x < 0)
                return sc.LINE_DRAW_TYPE.SLOPE;
        }
        return "If this return, you broke something horribly Bro.";
    }
    function h(a) {
        for (var b in a)
            return false;
        return true;
    }
    var i = Math.PI / 2,
        j = Math.PI / 4,
        k = i + j,
        l = Math.floor(20),
        o = !window.IG_GAME_DEBUG || false,
        m = [{
            element: sc.ELEMENT.NEUTRAL,
            startDir: {
                x: 0,
                y: -1
            },
            node: {
                x: 375,
                y: 375
            },
            offset: {
                x: 1095,
                y: 1095
            },
            size: {
                x: 751,
                y: 751
            },
            shadeBlock: {
                ids: [7, 8, 20, 21, 33, 34, 46, 47],
                levels: [225, 225]
            }
        }, {
            element: sc.ELEMENT.HEAT,
            rotation: i,
            startDir: {
                x: 1,
                y: 0
            },
            node: {
                x: 519,
                y: 199
            },
            offset: {
                x: 951,
                y: 1990
            },
            size: {
                x: 1039,
                y: 951
            },
            shadeBlock: {
                ids: [64, 63, 89, 97, 98, 118, 119, 128, 127, 105, 73, 72],
                levels: [230, 410]
            }
        }, {
            element: sc.ELEMENT.COLD,
            rotation: -i,
            startDir: {
                x: -1,
                y: 0
            },
            node: {
                x: 519,
                y: 751
            },
            offset: {
                x: 951,
                y: 0
            },
            size: {
                x: 1039,
                y: 951
            },
            shadeBlock: {
                ids: [176, 205, 206, 214, 215, 151, 150, 160, 159, 184, 185, 192],
                levels: [230, 410]
            }
        }, {
            rotation: 0,
            element: sc.ELEMENT.SHOCK,
            startDir: {
                x: 0,
                y: -1
            },
            node: {
                x: 199,
                y: 519
            },
            offset: {
                x: 1990,
                y: 951
            },
            size: {
                x: 951,
                y: 1039
            },
            shadeBlock: {
                ids: [7, 8, 20, 21, 33, 34, 46, 47,
                    246, 247, 279, 301, 302],
                levels: [230, 410]
            }
        }, {
            element: sc.ELEMENT.WAVE,
            rotation: Math.PI,
            startDir: {
                x: 0,
                y: 1
            },
            node: {
                x: 751,
                y: 519
            },
            offset: {
                x: 0,
                y: 951
            },
            size: {
                x: 951,
                y: 1039
            },
            shadeBlock: {
                ids: [7, 8, 20, 21, 33, 34, 46, 47, 333, 334, 366, 388, 389],
                levels: [230, 410]
            }
        }
        ],
        n = Vec2.createC(0, 0),
        p = Vec2.createC(0, 0),
        r = Vec2.createC(0, 0),
        t = Vec2.createC(0, 0),
        q = Vec2.createC(0, 0),
        s = Vec2.createC(0, 0),
        v = Vec2.createC(0, 0),
        y = {
            225: 0,
            230: 40,
            231: 80,
            410: 80
        },
        u = Vec2.createC(0, 0);
    sc.CircuitTreeDetailContainer2 = ig.GuiElementBase.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        transitions: {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    scaleX: 0.5,
                    scaleY: 0.5
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        },
        trees: [],
        cursor: null,
        _lastMousePos: Vec2.createC(0, 0),
        _dragTimer: 0,
        _cameraLastPositions: [],
        _lastDevice: 0,
        _gamepadActive: false,
        _cursorPos: [],
        _delayedDrag: false,
        init: function () {
            this.parent();
            this.setSize(ig.system.width, ig.system.height);
            this.setPivot(ig.system.width / 2, ig.system.height / 2);
            if (!this.constructor.PATTERN)
                this.constructor.PATTERN =
                    this.gfx.createPattern(0, 192, 64, 64, ig.ImagePattern.OPT.REPEAT_X_AND_Y);
            this.hook.setMouseRecord(true);
            this.cursor = new sc.CiruitCursor;
            this.addChildGui(this.cursor);
            this.doStateTransition("HIDDEN", true);
        },
        scrollToTree: function (a, b, c, d) {
            var e = null;
            if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                e = this._cursorPos[a];
                this._initCursorPos(e, a);
                sc.menu.skillCursor.x = e.x;
                sc.menu.skillCursor.y = e.y;
                this.limitCursorPos(a);
                this.cursor.moveTo(sc.menu.skillCursor.x, sc.menu.skillCursor.y, b != -1, c);
                sc.menu.skillCamera.x =
                    Math.floor(-e.x + ig.system.width / 2);
                sc.menu.skillCamera.y = Math.floor(-e.y + ig.system.height / 2);
            } else {
                e = this._cameraLastPositions[a];
                sc.menu.skillCamera.x = e.x;
                sc.menu.skillCamera.y = e.y;
            }
            this.limitCameraPos(a);
            this.doScrollTransition(sc.menu.skillCamera.x, sc.menu.skillCamera.y, c, KEY_SPLINES.EASE, d);
        },
        limitCameraPos: function (a) {
            var a = m[a],
                b = -sc.menu.skillCamera.x,
                c = Math.floor(162);
            sc.menu.skillCamera.x = -b.limit(a.offset.x - c, a.offset.x + (a.size.x - ig.system.width) + c);
            b = -sc.menu.skillCamera.y;
            c = Math.floor(42);
            sc.menu.skillCamera.y = -b.limit(a.offset.y - c, a.offset.y + (a.size.y - ig.system.height) + c);
        },
        limitCursorPos: function (a) {
            var a = m[a],
                b = sc.menu.skillCursor.x;
            sc.menu.skillCursor.x = b.limit(a.offset.x - 32 + 16 - 120, a.offset.x + (a.size.x - 16) + 32 + 120);
            var b = sc.menu.skillCursor.y,
                c = sc.menu.skillCursor.x + sc.menu.skillCamera.x;
            sc.menu.skillCursor.y = b.limit(a.offset.y, a.offset.y + a.size.y - (c < 181 ? Math.min(25, 181 - c) : 0));
        },
        switchElementTree: function (a, b) {
            if (a >= 0) {
                this._addTreeLazy(a);
                if (b != -1) {
                    var c = this._cameraLastPositions[b];
                    c.x = sc.menu.skillCamera.x;
                    c.y = sc.menu.skillCamera.y;
                    if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                        c = this._cursorPos[b];
                        c.x = sc.menu.skillCursor.x;
                        c.y = sc.menu.skillCursor.y;
                    }
                    this.trees[b].deactivate(true);
                    this.trees[a].activate(false);
                    this.scrollToTree(a, b, 0.5, function () {
                        this.trees[sc.menu.previousSkillTree].doStateTransition("HIDDEN", true);
                    }
                        .bind(this));
                    ig.interact.setBlockDelay(0.5);
                } else {
                    this.trees[a].activate(true);
                    this.scrollToTree(a, b);
                    this.doStateTransition("DEFAULT");
                }
                this._checkLastDevice();
            } else {
                if (b !=
                    -1) {
                    c = this._cameraLastPositions[b];
                    c.x = sc.menu.skillCamera.x;
                    c.y = sc.menu.skillCamera.y;
                    if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                        c = this._cursorPos[b];
                        c.x = sc.menu.lastSkillCursor.x;
                        c.y = sc.menu.lastSkillCursor.y;
                    }
                }
                this.doStateTransition("HIDDEN");
            }
        },
        exitMenu: function () {
            for (var a = this.trees.length; a--;)
                this.trees[a] && this.trees[a].exit();
            this.doStateTransition("HIDDEN");
        },
        addObservers: function () {
            sc.Model.addObserver(sc.menu, this);
            this.cursor.addObservers();
            for (var a = this.trees.length; a--;)
                this.trees[a] &&
                    this.trees[a].addObservers();
        },
        removeObservers: function () {
            this.cursor.removeObservers();
            sc.Model.removeObserver(sc.menu, this);
            for (var a = this.trees.length; a--;)
                this.trees[a] && this.trees[a].removeObservers();
        },
        update: function () {
            sc.menu.skillCursorMoved = false;
            if (!ig.interact.isBlocked() && !(sc.menu.skillState == sc.MENU_SKILL_STATE.NODE_MENU || sc.menu.skillState == sc.MENU_SKILL_STATE.OVERVIEW || sc.menu.currentSkillTree >= 0 && !this.trees[sc.menu.currentSkillTree].buttonGroup.isActive())) {
                var a = sc.menu.currentSkillTree;
                if (this._lastDevice != ig.input.currentDevice) {
                    this._gamepadActive = ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD;
                    this._lastDevice = ig.input.currentDevice;
                    var b = null;
                    if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                        b = this._cursorPos[a];
                        this._initCursorPos(b, a);
                        sc.menu.skillCursor.x = b.x;
                        sc.menu.skillCursor.y = b.y;
                        this.limitCursorPos(a);
                        sc.menu.skillCamera.x = Math.floor(-b.x + ig.system.width / 2);
                        sc.menu.skillCamera.y = Math.floor(-b.y + ig.system.height / 2);
                        this.limitCameraPos(a);
                        this.doScrollTransition(sc.menu.skillCamera.x,
                            sc.menu.skillCamera.y, 0.3, KEY_SPLINES.EASE);
                        this.cursor.moveTo(sc.menu.skillCursor.x, sc.menu.skillCursor.y);
                    } else if (ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE) {
                        b = this._cursorPos[a];
                        if (sc.menu.currentSkillFocus) {
                            b.x = sc.menu.skillRecoverPos.x;
                            b.y = sc.menu.skillRecoverPos.y;
                        } else {
                            b.x = sc.menu.skillCursor.x;
                            b.y = sc.menu.skillCursor.y;
                        }
                        sc.menu.unfocusCursor(sc.menu.currentSkillFocus);
                    }
                    sc.menu.toggledInputMode();
                }
                a = false;
                if (!this.hook.scrollTransition) {
                    if (sc.control.menuSkillLeft(0.5)) {
                        sc.menu.skillCamera.x =
                            Math.floor(sc.menu.skillCamera.x + 250 * ig.system.actualTick);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                        this.hook.scroll.x = sc.menu.skillCamera.x;
                        a = true;
                    } else if (sc.control.menuSkillRight(0.5)) {
                        sc.menu.skillCamera.x = Math.floor(sc.menu.skillCamera.x - 250 * ig.system.actualTick);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                        this.hook.scroll.x = sc.menu.skillCamera.x;
                        a = true;
                    }
                    if (sc.control.menuSkillUp(0.5)) {
                        sc.menu.skillCamera.y = Math.floor(sc.menu.skillCamera.y + 250 * ig.system.actualTick);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                        this.hook.scroll.y = sc.menu.skillCamera.y;
                        a = true;
                    } else if (sc.control.menuSkillDown(0.5)) {
                        sc.menu.skillCamera.y = Math.floor(sc.menu.skillCamera.y - 250 * ig.system.actualTick);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                        this.hook.scroll.y = sc.menu.skillCamera.y;
                        a = true;
                    }
                }
                if (!a && ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                    var c = b = 0,
                        d = 0,
                        a = false;
                    if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_X)) < -0.5) {
                        b = (-150 + d * 100) * ig.system.actualTick;
                        a = true;
                    } else if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_X)) >
                        0.5) {
                        b = (150 + d * 100) * ig.system.actualTick;
                        a = true;
                    }
                    if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_Y)) < -0.5) {
                        c = (-150 + d * 100) * ig.system.actualTick;
                        a = true;
                    } else if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_Y)) > 0.5) {
                        c = (150 + d * 100) * ig.system.actualTick;
                        a = true;
                    }
                    if (a) {
                        sc.menu.skillCursorMoved = true;
                        sc.menu.skillCursor.x = b >= 0 ? Math.floor(sc.menu.skillCursor.x + b) : Math.ceil(sc.menu.skillCursor.x + b);
                        sc.menu.skillCursor.y = c >= 0 ? Math.floor(sc.menu.skillCursor.y + c) : Math.ceil(sc.menu.skillCursor.y + c);
                        this.limitCursorPos(sc.menu.currentSkillTree);
                        this.cursor.moveTo(sc.menu.skillCursor.x, sc.menu.skillCursor.y);
                        u.x = sc.menu.skillCamera.x;
                        u.y = sc.menu.skillCamera.y;
                        sc.menu.skillCamera.x = Math.floor(-sc.menu.skillCursor.x + ig.system.width / 2);
                        sc.menu.skillCamera.y = Math.floor(-sc.menu.skillCursor.y + ig.system.height / 2);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                    }
                    a = false;
                    if (Math.abs(sc.menu.skillCamera.x - u.x) >= 18 || Math.abs(sc.menu.skillCamera.y - u.y) >= 18)
                        a = true;
                    if (this.hook.scrollTransition) {
                        this.hook.scrollTransition.x = sc.menu.skillCamera.x;
                        this.hook.scrollTransition.y =
                            sc.menu.skillCamera.y;
                    } else if (a)
                        this.doScrollTransition(sc.menu.skillCamera.x, sc.menu.skillCamera.y, 0.3, KEY_SPLINES.LINEAR);
                    else {
                        this.hook.scroll.x = sc.menu.skillCamera.x;
                        this.hook.scroll.y = sc.menu.skillCamera.y;
                    }
                }
            }
        },
        updateDrawables: function (a) {
            var b = this.hook;
            b.hasTransition() ? a.addPattern(this.constructor.PATTERN, -256, -256, -b.scroll.x, -b.scroll.y, 1216, 704) : a.addPattern(this.constructor.PATTERN, 0, 0, -b.scroll.x, -b.scroll.y, b.size.x, b.size.y);
        },
        onMouseInteract: function (a, b) {
            if (!(ig.interact.isBlocked() ||
                this.trees[sc.menu.currentSkillFocus] && !this.trees[sc.menu.currentSkillTree].buttonGroup.isActive()))
                if (sc.menu.currentSkillTree == -1 || sc.menu.skillState == sc.MENU_SKILL_STATE.NODE_MENU)
                    if (a && sc.control.getGuiPressed()) {
                        sc.menu.exitNodeMenu();
                        sc.menu.unfocusCursor(sc.menu.currentSkillFocus);
                        this._delayedDrag = true;
                    } else
                        sc.menu.skillDrag = false;
                else if (!b) {
                    var c = Math.floor(sc.control.getMouseX()),
                        d = Math.floor(sc.control.getMouseY());
                    if (sc.control.getGuiPressed() || this._delayedDrag) {
                        this._delayedDrag = false;
                        Vec2.assignC(this._lastMousePos, c, d);
                        sc.menu.skillDrag = true;
                        this._dragTimer = 0;
                    } else if (sc.control.getGuiHold()) {
                        if (sc.menu.skillDrag) {
                            this._dragTimer = this._dragTimer + ig.system.actualTick;
                            if (!sc.menu.skillWasDragged)
                                sc.menu.skillWasDragged = (Math.abs(c - this._lastMousePos.x) >= 1 || Math.abs(d - this._lastMousePos.y) >= 1) && this._dragTimer >= 0.1;
                            sc.menu.skillCamera.x = sc.menu.skillCamera.x + (c - this._lastMousePos.x);
                            sc.menu.skillCamera.y = sc.menu.skillCamera.y + (d - this._lastMousePos.y);
                            this.limitCameraPos(sc.menu.currentSkillTree);
                            this.hook.scroll.x = sc.menu.skillCamera.x;
                            this.hook.scroll.y = sc.menu.skillCamera.y;
                            Vec2.assignC(this._lastMousePos, c, d);
                        }
                    } else
                        sc.menu.skillDrag = false;
                }
        },
        modelChanged: function (a, b, c) {
            if (a == sc.menu)
                if (b == sc.MENU_EVENT.SKILL_NODE_SELECT) {
                    this.limitCameraPos(sc.menu.currentSkillTree);
                    this.doScrollTransition(sc.menu.skillCamera.x, sc.menu.skillCamera.y, 0.2);
                } else if (b == sc.MENU_EVENT.SKILL_CURSOR_FOCUS_NODE) {
                    if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                        sc.menu.skillCamera.x = Math.floor(-sc.menu.skillCursor.x +
                            ig.system.width / 2);
                        sc.menu.skillCamera.y = Math.floor(-sc.menu.skillCursor.y + ig.system.height / 2);
                        this.limitCameraPos(sc.menu.currentSkillTree);
                        this.doScrollTransition(sc.menu.skillCamera.x, sc.menu.skillCamera.y, 0.2, KEY_SPLINES.LINEAR);
                    }
                } else if (b == sc.MENU_EVENT.CIRCUIT_FOCUS_CAM) {
                    this.limitCameraPos(sc.menu.currentSkillTree);
                    this.doScrollTransition(sc.menu.skillCamera.x, sc.menu.skillCamera.y, c ? c.time || 0.2 : 0.2, void 0, c && c.callback);
                }
        },
        _initCursorPos: function (a, b) {
            if (a.x <= -1E4 || a.y <= -1E4) {
                a.x = -this._cameraLastPositions[b].x +
                    ig.system.width / 2;
                a.y = -this._cameraLastPositions[b].y + ig.system.height / 2;
            }
        },
        _checkLastDevice: function () {
            if (this._lastDevice != ig.input.currentDevice) {
                this._gamepadActive = ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD;
                this._lastDevice = ig.input.currentDevice;
            }
        },
        _addTreeLazy: function (a) {
            if (!this.trees[a]) {
                this.trees[a] = new sc.CircuitTreeDetail2(a);
                this.trees[a].setPos(m[a].offset.x, m[a].offset.y);
                var b = Vec2.createC(0, 0);
                b.x = ig.system.width / 2 - m[a].node.x - m[a].offset.x;
                b.y = ig.system.height / 2 - m[a].node.y -
                    m[a].offset.y;
                this._cameraLastPositions[a] = b;
                this._cursorPos[a] = Vec2.createC(-1E4, -1E4);
                this.insertChildGui(this.trees[a], 0);
            }
        }
    });
    sc.CircuitTreeDetail2 = ig.GuiElementBase.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        transitions: {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        },
        tree: null,
        buttonGroup: null,
        skills: [],
        skillStart: 0,
        effectGuis: [],
        init: function (a) {
            this.parent();
            this.setSize(m[a].size.x, m[a].size.y);
            if (a == void 0)
                throw Error("Element muss be defined");
            this.tree = m[a];
            this.buttonGroup = new sc.CircuitDetailButtonGroup;
            sc.Model.addObserver(sc.model.player2, this);
            sc.Model.addObserver(sc.menu, this);
            this._createTree();
            this.doStateTransition("DEFAULT", true);
        },
        updateDrawables: function (a) {
            window.IG_GAME_DEBUG && o && a.addColor("white", 0, 0, this.hook.size.x, this.hook.size.y).setAlpha(0.05);
        },
        addObservers: function () {
            sc.Model.addObserver(sc.model.player2, this);
            sc.Model.addObserver(sc.menu, this);
        },
        removeObservers: function () {
            sc.Model.removeObserver(sc.model.player2, this);
            sc.Model.removeObserver(sc.menu, this);
        },
        activate: function (a, b) {
            sc.menu.buttonInteract.pushButtonGroup(this.buttonGroup);
            sc.menu.pushBackCallback(this._onBackButtonPress.bind(this));
            ig.interact.setBlockDelay(0.2);
            this.doStateTransition("DEFAULT", a, false, b || null);
        },
        deactivate: function (a) {
            for (var b = this.effectGuis.length; b--;) {
                this.effectGuis[b].hide();
                this.removeChildGui(this.effectGuis[b]);
            }
            this.effectGuis.length = 0;
            sc.menu.popBackCallback();
            sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
            a ||
                this.doStateTransition("HIDDEN");
        },
        exit: function () {
            sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
        },
        modelChanged: function (a, b, c) {
            if (a == sc.model.player2) {
                if (b == sc.PLAYER_MSG.SKILL_CHANGED && c >= this.skillStart && c <= this.skillStart + this.skills.length - 1)
                    for (a = this.skills.length; a--;)
                        this.skills[a].updateIconAlpha();
            } else
                a == sc.menu && b == sc.MENU_EVENT.SKILL_SHOW_EFFECT && this._showEffect(c.gui, c.isSwitch, c.delay);
        },
        _showEffect: function (a, b, c) {
            if (a && this.tree.element == a.element) {
                var d = new sc.CircuitEffectDisplay;
                this.addChildGui(d);
                d.show(a, b, c);
                this.effectGuis.push(d);
            }
        },
        _onBackButtonPress: function () {
            this.deactivate();
            sc.menu.selectSkillTree(-1);
        },
        _createTree: function () {
            var a = sc.skilltree.getTree(this.tree.element);
            r.x = this.tree.node.x;
            r.y = this.tree.node.y;
            var b = this.tree.startDir.x,
                c = this.tree.startDir.y;
            n.x = b;
            n.y = c;
            var d = null;
            this.skillStart = a[0].uid;
            d = new sc.CircuitTreeDetail2.Start(r.x, r.y, b, c, this.tree.element, a);
            this.addChildGui(d);
            for (var f = 0; f < a.length; f++) {
                d = a[f];
                h(d) || this._createTreeNodesRecursive(d,
                    this.tree.element, r.x, r.y, b, c, null);
                e("CW_90", b, c);
                b = n.x;
                c = n.y;
            }
        },
        _createTreeNodesRecursive: function (a, b, c, d, f, g, i) {
            var j = false,
                k = null,
                m = null;
            if (a.orBranch) {
                var l = a.orBranch;
                e(a.direction, f, g);
                j = Math.abs(n.x) == 1 && Math.abs(n.y) == 1;
                c = c + (a.distance + (j ? 2 : 3)) * 8 * n.x;
                d = d + (a.distance + (j ? 2 : 3)) * 8 * n.y;
                p.x = n.x;
                p.y = n.y;
                e(l.direction, n.x, n.y);
                (j = Math.abs(n.x) == 1 && Math.abs(n.y) == 1) && ig.error("orBranch can't be rendered with a slope direction.");
                k = new sc.CircuitTreeDetail2.OrBranchLine(c, d, n.x, n.y, l, a, b, false);
                this.addChildGui(k);
                for (var c = c + (j ? 3 : 6) * 8 * n.x, d = d + (j ? 3 : 6) * 8 * n.y, f = k = null, g = i, o = 0; o < 3; o++) {
                    if (o + 1 >= 3)
                        k = f = a.children[0];
                    else {
                        k = l.left[o + 1];
                        f = l.right[o + 1];
                    }
                    if (n.x != 0) {
                        k = new sc.CircuitTreeDetail2.Node(c, d + (n.x > 0 ? -24 : 24), n.x, n.y, l.left[o], b, k, this.buttonGroup, this.skillStart, g, o, l.levels, true);
                        if (g)
                            g.nextGui = k;
                        g = k;
                        this.addChildGui(k);
                        this.skills[l.left[o].uid - this.skillStart] = k;
                        k = new sc.CircuitTreeDetail2.Node(c, d + (n.x > 0 ? 24 : -24), n.x, n.y, l.right[o], b, f, this.buttonGroup, this.skillStart, i, o, l.levels, false);
                    } else {
                        k = new sc.CircuitTreeDetail2.Node(c +
                            (n.y > 0 ? 24 : -24), d, n.x, n.y, l.left[o], b, k, this.buttonGroup, this.skillStart, g, o, l.levels, true);
                        if (g)
                            g.nextGui = k;
                        g = k;
                        this.addChildGui(k);
                        this.skills[l.left[o].uid - this.skillStart] = k;
                        k = new sc.CircuitTreeDetail2.Node(c + (n.y > 0 ? -24 : 24), d, n.x, n.y, l.right[o], b, f, this.buttonGroup, this.skillStart, i, o, l.levels, false);
                    }
                    if (i)
                        i.nextGui = k;
                    i = k;
                    this.addChildGui(k);
                    g.orGui = i;
                    i.orGui = g;
                    this.skills[l.right[o].uid - this.skillStart] = k;
                    c = c + (j ? 3 : 5) * 8 * n.x;
                    d = d + (j ? 3 : 5) * 8 * n.y;
                    m = k;
                }
                c = c - (j ? 1 : 2) * 8 * n.x;
                d = d - (j ? 1 : 2) * 8 * n.y;
                k = new sc.CircuitTreeDetail2.OrBranchLine(c,
                    d, n.x, n.y, l, a, b, true);
                this.addChildGui(k);
                c = c + 8 * n.x;
                d = d + 8 * n.y;
            } else {
                e(a.direction, f, g);
                j = Math.abs(n.x) == 1 && Math.abs(n.y) == 1;
                c = c + (a.distance + (j ? 3 : 5)) * 8 * n.x;
                d = d + (a.distance + (j ? 3 : 5)) * 8 * n.y;
                k = new sc.CircuitTreeDetail2.Node(c, d, n.x, n.y, a, b, null, this.buttonGroup, this.skillStart, i);
                this.addChildGui(k);
                m = this.skills[a.uid - this.skillStart] = k;
            }
            a = a.children;
            if (a.length != 0) {
                j = null;
                f = n.x;
                g = n.y;
                for (l = 0; l < a.length; l++) {
                    j = a[l];
                    if (!h(j)) {
                        d = this._createLine(j, b, c, d, f, g);
                        this._createTreeNodesRecursive(j, b, c, d, f, g, m);
                    }
                }
            }
        },
        _createLine: function (a, b, c, d, f, g) {
            if (a.distance <= 0)
                return d;
            e(a.direction, f, g);
            n.x == 1 && (n.y == -1 && a.orBranch) && (d = d - 1);
            a = new sc.CircuitTreeDetail2.Line(c, d, n.x, n.y, a, b);
            this.addChildGui(a);
            return d;
        }
    });
    sc.CircuitTreeDetail2.Start = ig.GuiElementBase.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        element: 0,
        children: null,
        dirX: 0,
        dirY: 0,
        centerPos: 0,
        init: function (a, b, c, d, e, f) {
            this.parent();
            this.setSize(40, 40);
            this.setPos(a - l, b - l);
            this.element = e;
            this.children = f;
            this.dirX = c;
            this.dirY = d;
            this.centerPos = l - 6;
        },
        updateDrawables: function (b) {
            window.IG_GAME_DEBUG && o && b.addColor("red", 1, 1, 39, 39).setAlpha(0.2);
            b.addGfx(this.gfx, this.centerPos, this.centerPos, 56, 0 + this.element * 16, 13, 13);
            a(b, this.gfx, null, this.children, l, l, this.dirX, this.dirY, this.element, true);
        }
    });
    sc.CircuitTreeDetail2.Node = ig.FocusGui.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        icons: new ig.Image("media/gui/circuit-icons.png"),
        parentGui: null,
        element: 0,
        skill: null,
        branchSkill: null,
        coords: {
            x: 5,
            y: 5,
            w: 31,
            h: 31
        },
        dirX: 0,
        dirY: 0,
        centerPos: 0,
        orBranchIndex: -1,
        orLevels: null,
        orLeft: true,
        blocked: false,
        blockID: 0,
        submitSound: null,
        blockedSound: null,
        _iconAlpha: 1,
        _player: null,
        _buttonGroup: null,
        init: function (a, c, d, e, f, g, h, i, j, k, m, o, n) {
            this.parent();
            this.setSize(41, 41);
            this.setPos(a - l, c - l);
            this.parentGui = k || null;
            this.element = g;
            this.skill = f;
            this.dirX = d;
            this.dirY = e;
            this.centerPos = l - 15;
            this.submitSound = sc.BUTTON_SOUND.submit;
            this.blockedSound = sc.BUTTON_SOUND.denied;
            this._player = sc.model.player2;
            this.updateIconAlpha();
            if (h) {
                this.branchSkill = [];
                this.branchSkill.push(h);
                this.orBranchIndex = m;
                this.orLevels = o;
                this.orLeft = n == void 0 ? true : n;
                this.blockID = cachedRingMenuPos(this.skill.uid, this.orLevels[this.orBranchIndex], this.element);
            } else
                this.blockID = cachedRingMenuPos(this.skill.uid, this.skill.level, this.element);
            if (this.blockID > 0)
                this.blocked = true;
            (this._buttonGroup = i) && i.addFocusGui(this, f.uid - j || 0, 0);
        },
        updateIconAlpha: function () {
            this._iconAlpha = 1;
            if (!this._player.hasSkill(this.skill.uid))
                this._iconAlpha = this._calculateAlpha(this.parentGui, this._iconAlpha);
        },
        getOffsetX: function () {
            return m[this.element].offset.x;
        },
        getOffsetY: function () {
            return m[this.element].offset.y;
        },
        getDistanceToCursor: function () {
            return Math.floor(Vec2.distanceC(sc.menu.skillCursor.x - m[this.element].offset.x, sc.menu.skillCursor.y - m[this.element].offset.y, this.hook.pos.x + l, this.hook.pos.y + l));
        },
        updateDrawables: function (b) {
            if (window.IG_GAME_DEBUG) {
                o && b.addColor(this.branchSkill ? "yellow" : "green", 1, 1, 39, 39).setAlpha(0.2);
                o && b.addColor(this.branchSkill ? "yellow" : "green", 5, 5, 31, 31).setAlpha(0.2);
            }
            var c = sc.model.player2.hasSkill(this.skill.uid);
            b.addGfx(this.gfx,
                this.centerPos, this.centerPos, 0, c ? 32 + this.element * 32 : 0, 31, 31);
            if (this._iconAlpha > 0) {
                c = sc.skilltree.getSkill(this.skill.uid).icon;
                b.addGfx(this.icons, 8, 8, c % 10 * 24, Math.floor(c / 10) * 24, 24, 24).setAlpha(this._iconAlpha);
            }
            a(b, this.gfx, this.skill, this.branchSkill ? this.branchSkill : this.skill.children, l, l, this.dirX, this.dirY, this.element, false, this.orBranchIndex, this.orLevels);
            if (this.blocked) {
                c = m[this.element].shadeBlock.levels[(this.branchSkill ? this.orLevels[this.orBranchIndex] : this.skill.level) - 2];
                c = y[c];
                b.addGfx(this.gfx, this.centerPos, this.centerPos, 480, 168 + c, 32, 40);
            }
        },
        onButtonPress: function () {
            if (sc.menu.skillWasDragged)
                sc.menu.skillWasDragged = false;
            else {
                var a = false;
                if (this._checkParentForBlock(this.parentGui))
                    this.blockedSound && this.blockedSound.play();
                else {
                    this.parentGui && (this._hasParent(this.parentGui) || (a = true));
                    if (ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE) {
                        var b = Math.floor(sc.control.getMouseY());
                        if (b <= 21 || b >= 299)
                            return;
                    }
                    this.submitSound && this.submitSound.play();
                    sc.menu.centerOnNode(this,
                        a);
                }
            }
        },
        onMouseInteract: function (a, b) {
            ig.input.state("shift") || this.parent(a, b);
        },
        isMouseOver: function () {
            if (sc.menu.currentSkillTree == -1 || sc.menu.skillState == sc.MENU_SKILL_STATE.NODE_MENU)
                return false;
            if (sc.menu.skillDrag)
                return sc.menu.currentSkillFocus == this;
            if (!ig.interact.isBlocked() && this._buttonGroup.isActive()) {
                if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                    var a = this.getDistanceToCursor();
                    if (sc.menu.skillCursorMoved) {
                        sc.menu.unfocusCursor(this);
                        return false;
                    }
                    if (a <= 14) {
                        sc.menu.focusCursorOnNode(this.hook.pos.x +
                            20 + m[this.element].offset.x, this.hook.pos.y + 20 + m[this.element].offset.y, this);
                        return true;
                    }
                    sc.menu.unfocusCursor(this);
                    return false;
                }
                var a = Math.floor(sc.control.getMouseX()),
                    b = Math.floor(sc.control.getMouseY());
                if (b <= 21 || b >= 299) {
                    sc.menu.unfocusCursor(this);
                    return false;
                }
                this.coords.x = 5 + this.hook.screenCoords.x;
                this.coords.y = 5 + this.hook.screenCoords.y;
                (a = this.coords.x <= a && this.coords.x + this.coords.w > a && this.coords.y <= b && this.coords.y + this.coords.h > b) && !ig.input.state("shift") ? sc.menu.focusCursorOnNode(this.hook.pos.x +
                    20 + m[this.element].offset.x, this.hook.pos.y + 20 + m[this.element].offset.y, this) : sc.menu.unfocusCursor(this);
                return a;
            }
        },
        getNodeFocus: function (a) {
            a = a || Vec2.createC(0, 0);
            a.x = this.hook.pos.x + 20 + m[this.element].offset.x;
            a.y = this.hook.pos.y + 20 + m[this.element].offset.y;
            return a;
        },
        _hasParent: function (a) {
            if (a)
                if (a.branchSkill)
                    if (a.orBranchIndex == 2) {
                        if (!sc.model.player2.hasSkill(a.skill.uid) && !sc.model.player2.hasSkill(a.skill.uid - 1))
                            return false;
                    } else if (a.orLeft) {
                        if (!sc.model.player2.hasSkill(a.skill.uid) && !sc.model.player2.hasSkill(a.skill.uid +
                            1))
                            return false;
                    } else {
                        if (!sc.model.player2.hasSkill(a.skill.uid) && !sc.model.player2.hasSkill(a.skill.uid - 1))
                            return false;
                    }
                else if (!sc.model.player2.hasSkill(a.skill.uid))
                    return false;
            return true;
        },
        _checkParentForBlock: function (a) {
            return this.blocked ? true : a ? a.blocked ? true : a.parentGui ? a.parentGui.blocked ? true : this._checkParentForBlock(a.parentGui) : false : false;
        },
        _calculateAlpha: function (a, b) {
            if (b <= 0.2)
                return 0.2;
            if (a) {
                if (a.branchSkill)
                    if (a.orBranchIndex == 2) {
                        if (this._player.hasSkill(a.skill.uid) || this._player.hasSkill(a.skill.uid -
                            1))
                            return b;
                    } else if (a.orLeft) {
                        if (this._player.hasSkill(a.skill.uid) || this._player.hasSkill(a.skill.uid + 1))
                            return b;
                    } else {
                        if (this._player.hasSkill(a.skill.uid) || this._player.hasSkill(a.skill.uid - 1))
                            return b;
                    }
                else if (this._player.hasSkill(a.skill.uid))
                    return b;
                return this._calculateAlpha(a.parentGui, (b * 100 - 20) / 100);
            }
            return b;
        }
    });
    sc.CircuitTreeDetail2.OrBranchLine = ig.GuiElementBase.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        orSkill: null,
        skill: null,
        element: 0,
        dirX: 0,
        dirY: 0,
        drawDir: 0,
        flip: false,
        levelOffset: 0,
        uidLeft: 0,
        uidRight: 0,
        uidNext: -1,
        uidLeftNext: -1,
        uidRightNext: -1,
        hasBranchChildren: false,
        init: function (a, b, c, d, e, f, h, i) {
            this.parent();
            this.setPos(a, b);
            this.element = h;
            this.orSkill = e;
            this.skill = f;
            this.dirX = c;
            this.dirY = d;
            this.flip = i != void 0 ? i : false;
            n.x = c;
            n.y = d;
            this.levelOffset = this.flip ? Math.max(0, f.children[0].level - 1) * 56 : Math.max(0, e.levels[0] - 1) * 56;
            this.uidLeft = this.orSkill.left[0].uid;
            this.uidRight = this.orSkill.right[0].uid;
            this.uidLeftNext = this.skill ? this.orSkill.left[2].uid : -1;
            this.uidRightNext =
                this.skill ? this.orSkill.right[2].uid : -1;
            this.hasBranchChildren = this.skill.children[0].orBranch ? true : false;
            this.uidNext = this.skill ? this.skill.children[0].uid : -1;
            if (this.hasBranchChildren) {
                this.uidLeftNext = this.skill ? this.skill.children[0].orBranch.left[0].uid : -1;
                this.uidRightNext = this.skill ? this.skill.children[0].orBranch.right[0].uid : -1;
                if (this.flip)
                    this.levelOffset = Math.max(0, this.skill.children[0].orBranch.levels[0] - 1) * 56;
            }
            this.drawDir = g(n);
            switch (this.drawDir) {
                case sc.LINE_DRAW_TYPE.HORZ:
                    this.setSize(32,
                        56);
                    this.setPos(a + (c > 0 ? -3 : -27), b - 27);
                    break;
                case sc.LINE_DRAW_TYPE.VERT:
                    this.setSize(56, 32);
                    this.setPos(a - 27, b + (d > 0 ? -3 : -27));
                    break;
                case sc.LINE_DRAW_TYPE.SLOPE:
                    ig.warn("This will lead to an error bro, we can't draw orBranches in slopes: " + Vec2.print(c, d));
            }
        },
        updateDrawables: function (a) {
            window.IG_GAME_DEBUG && o && a.addColor("yellow", 0, 0, this.hook.size.x, this.hook.size.y).setAlpha(0.2);
            var b = sc.model.player2,
                c = b.hasSkill(this.uidLeft),
                d = b.hasSkill(this.uidRight),
                e = c || d;
            if (this.dirX < 0 || this.dirY < 0)
                if (c &&
                    d)
                    c = d = true;
                else if (d) {
                    c = true;
                    d = false;
                } else if (c) {
                    d = true;
                    c = false;
                }
            var f = false;
            d && !c && (f = true);
            var g = this.flip;
            if (this.dirX < 0 || this.dirY < 0)
                g = !g;
            if (this.flip)
                if (this.hasBranchChildren) {
                    c = b.hasSkill(this.uidLeftNext);
                    d = b.hasSkill(this.uidRightNext);
                    e = c || d;
                } else
                    e = b.hasSkill(this.uidNext);
            switch (this.drawDir) {
                case sc.LINE_DRAW_TYPE.HORZ:
                    a.addGfx(this.gfx, 0, f ? -1 : 0, e ? 352 + this.element * 32 : 320, this.levelOffset, 32, 56, g, f);
                    break;
                case sc.LINE_DRAW_TYPE.VERT:
                    a.addGfx(this.gfx, f ? -1 : 0, 0, this.levelOffset, e ? 344 + this.element *
                        32 : 312, 56, 32, f, g);
            }
            c && d && a.addGfx(this.gfx, this.hook.size.x / 2 - 16, this.hook.size.y / 2 - 16, 480, 320, 32, 32);
        }
    });
    sc.CircuitTreeDetail2.Line = ig.GuiElementBase.extend({
        gfx: new ig.Image("media/gui/circuit.png"),
        endSkill: null,
        element: 0,
        dirX: 0,
        dirY: 0,
        overrideDistance: false,
        init: function (a, b, c, d, e, h) {
            this.parent();
            this.element = h;
            this.endSkill = e;
            this.dirX = c;
            this.dirY = d;
            n.x = c;
            n.y = d;
            c = e.distance * 8;
            d = g(n);
            h = d == sc.LINE_DRAW_TYPE.SLOPE;
            a = a + (h ? n.x > 0 ? 13 : c + 11 : n.x > 0 ? 21 : c + 19) * n.x;
            b = b + (h ? n.y > 0 ? n.x > 0 ? 12 : 11 : c + (n.x > 0 ? 13 : 12) : n.y >
                0 ? 21 : c + 19) * n.y;
            n.x == 0 && (a = a - 3);
            n.y == 0 && (b = b - 3);
            var i = h = 0;
            if (e.orBranch) {
                if (g(n) == sc.LINE_DRAW_TYPE.SLOPE) {
                    h = 3;
                    i = 6;
                    this.overrideDistance = true;
                }
                switch (f(n)) {
                    case sc.TREE_CARDINAL_DIR.SOUTH_WEST:
                        a = a - 3;
                        break;
                    case sc.TREE_CARDINAL_DIR.NORTH_EAST:
                        b = b - 2;
                        break;
                    case sc.TREE_CARDINAL_DIR.NORTH_WEST:
                        a = a - 3;
                        b = b - 3;
                }
            }
            this.setPos(a, b);
            switch (d) {
                case sc.LINE_DRAW_TYPE.HORZ:
                    this.setSize(c, 8);
                    break;
                case sc.LINE_DRAW_TYPE.VERT:
                    this.setSize(8, c);
                    break;
                case sc.LINE_DRAW_TYPE.SLOPE:
                    this.setSize(c + h, c + i);
            }
        },
        updateDrawables: function (a) {
            window.IG_GAME_DEBUG &&
                o && a.addColor("blue", 0, 0, this.hook.size.x, this.hook.size.y).setAlpha(0.2);
            this.overrideDistance ? d(a, this.gfx, this.endSkill, this.element, 0, 0, this.dirX, this.dirY, this.endSkill.distance * 8 + 3, false, true) : d(a, this.gfx, this.endSkill, this.element, 0, 0, this.dirX, this.dirY);
        }
    });
}

sc.CircuitSwapBranches2 = ig.GuiElementBase.extend({
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        SCALE: {
            state: {
                alpha: 0,
                scaleX: 1.5,
                scaleY: 1.5
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    buttonGroup: null,
    cursor: null,
    _gamepadActive: false,
    _lastDevice: 0,
    _cursorPos: Vec2.createC(-1E4, -1E4),
    _firstVisit: false,
    effectGuis: [],
    init: function () {
        this.parent();
        this.setSize(274, 274);
        this.setPos(sc.options.hdMode ? 147 : 103, 23);
        this.hook.pivot.x = Math.floor(137);
        this.hook.pivot.y = Math.floor(137);
        var a = d.length,
            b = null,
            b = null;
        this.buttonGroup = new sc.MouseButtonGroup;
        this.buttonGroup.ignoreActiveFocus =
            true;
        for (this.buttonGroup.onButtonTraversal = function () {
            if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD && sc.control.menuConfirm() && sc.menu.skillSwapFocus)
                sc.menu.skillSwapFocus.onButtonPress();
        }
            .bind(this); a--;) {
            b = d[a];
            if (sc.model.player2.hasElement(b.element))
                if (sc.skilltree.getSkill(b.startUID).type != sc.SKILL_STATES.OR_BRANCH_FIRST)
                    ig.warn("Swap Skill UID is not first branch UID: " + b.startUID + " [Panel will be skipped]");
                else {
                    b = new sc.CircuitSwapBranches2.Button(b.pos.x - 1, b.pos.y, b.startUID, b.element);
                    this.addChildGui(b);
                    this.buttonGroup.addFocusGui(b);
                }
        }
        this.cursor = new sc.CircuitSwapCursor;
        this.addChildGui(this.cursor);
        this.doStateTransition("HIDDEN", true);
    },
    update: function () {
        sc.menu.skillSwapMoved = false;
        if (!ig.interact.isBlocked() && this.buttonGroup.isActive()) {
            if (this._lastDevice != ig.input.currentDevice) {
                this._gamepadActive = ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD;
                this._lastDevice = ig.input.currentDevice;
                var a = null;
                if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                    a = this._cursorPos;
                    this._initCursor(a);
                    sc.menu.skillSwapCursor.x = a.x;
                    sc.menu.skillSwapCursor.y = a.y;
                    this._limitCursorPos();
                    sc.menu.resetSwapCursor();
                    this.cursor.moveTo(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y);
                } else if (ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE) {
                    this._cursorPos.x = sc.menu.skillSwapCursor.x;
                    this._cursorPos.y = sc.menu.skillSwapCursor.y;
                    this.cursor.unfocus();
                }
                sc.menu.toggledInputMode();
            }
            if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
                var b = a = 0,
                    d = 0,
                    g = false;
                if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_X)) <
                    -0.5) {
                    a = (-100 + d * 100) * ig.system.actualTick;
                    g = true;
                } else if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_X)) > 0.5) {
                    a = (100 + d * 100) * ig.system.actualTick;
                    g = true;
                }
                if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_Y)) < -0.5) {
                    b = (-100 + d * 100) * ig.system.actualTick;
                    g = true;
                } else if ((d = sc.control.getAxesValue(ig.AXES.LEFT_STICK_Y)) > 0.5) {
                    b = (100 + d * 100) * ig.system.actualTick;
                    g = true;
                }
                if (g) {
                    sc.menu.skillSwapMoved = true;
                    sc.menu.skillSwapCursor.x = a >= 0 ? Math.floor(sc.menu.skillSwapCursor.x + a) : Math.ceil(sc.menu.skillSwapCursor.x +
                        a);
                    sc.menu.skillSwapCursor.y = b >= 0 ? Math.floor(sc.menu.skillSwapCursor.y + b) : Math.ceil(sc.menu.skillSwapCursor.y + b);
                    this._limitCursorPos();
                    this.cursor.moveTo(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y);
                }
            }
        }
    },
    addObservers: function () {
        sc.Model.addObserver(sc.menu, this);
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.menu, this);
    },
    showMenu: function () {
        sc.menu.buttonInteract.pushButtonGroup(this.buttonGroup);
        sc.menu.pushBackCallback(this._onBackButtonPress.bind(this));
        sc.menu.resetSwapCursor();
        if (this._lastDevice != ig.input.currentDevice) {
            this._gamepadActive = ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD;
            this._lastDevice = ig.input.currentDevice;
        }
        this._focusButton();
        if (sc.menu.skillStateOrigin == sc.MENU_SKILL_STATE.DETAIL_VIEW) {
            this.doStateTransition("SCALE", true);
            this.doStateTransition("DEFAULT");
        } else
            this.doStateTransition("DEFAULT", true);
    },
    exitMenu: function () {
        this.cursor.unfocus();
        sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
        this.buttonGroup.unfocusCurrentButton();
        sc.menu.popBackCallback();
        for (var a = this.effectGuis.length; a--;) {
            this.effectGuis[a].hide();
            this.removeChildGui(this.effectGuis[a]);
        }
        this.effectGuis.length = 0;
        this.doStateTransition("HIDDEN", true);
    },
    _initCursor: function (a) {
        if (a.x <= -1E4 || a.y <= -1E4) {
            a.x = Math.floor(this.hook.size.x / 2);
            a.y = Math.floor(this.hook.size.y / 2);
        }
    },
    _limitCursorPos: function () {
        var a = sc.menu.skillSwapCursor.x;
        sc.menu.skillSwapCursor.x = a.limit(0, Math.floor(this.hook.size.x));
        a = sc.menu.skillSwapCursor.y;
        sc.menu.skillSwapCursor.y = a.limit(0, this.hook.size.y);
    },
    _focusButton: function () {
        if (this._firstVisit) {
            var a =
                this._cursorPos;
            a.x = sc.menu.skillSwapCursor.x;
            a.y = sc.menu.skillSwapCursor.y;
            this._limitCursorPos();
            this.cursor.moveTo(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y);
        } else if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
            this._firstVisit = true;
            a = this._cursorPos;
            this._initCursor(a);
            sc.menu.skillSwapCursor.x = a.x;
            sc.menu.skillSwapCursor.y = a.y;
            this._limitCursorPos();
            this.cursor.moveTo(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y);
        }
    },
    _onBackButtonPress: function () {
        sc.menu.leaveSwapBranches();
    },
    _showEffect: function (a) {
        if (a) {
            var b = new sc.CircuitEffectDisplay(true);
            this.addChildGui(b);
            b.show(a, true, 0, true);
            this.effectGuis.push(b);
        }
    },
    modelChanged: function (a, b, d) {
        a == sc.menu && (b == sc.MENU_EVENT.SKILL_ENTER_SWAP_BRANCHES ? this.showMenu() : b == sc.MENU_EVENT.SKILL_LEAVE_SWAP_BRANCHES ? this.exitMenu() : b == sc.MENU_EVENT.SKILL_TOGGLED_INPUT_MODE ? this.buttonGroup.isActive() && this.cursor.resetFocusTimer() : b == sc.MENU_EVENT.SKILL_SWAP_FOCUS ? this.buttonGroup.isActive() && this.cursor.focusOnNode(sc.menu.skillSwapCursor.x,
            sc.menu.skillSwapCursor.y) : b == sc.MENU_EVENT.SKILL_SWAP_UNFOCUS ? this.buttonGroup.isActive() && this.cursor.unfocus() : b == sc.MENU_EVENT.SKILL_SWAP_ENSURE ? this.buttonGroup.isActive() && (this.cursor.focus || this.cursor.focusOnNode(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y)) : b == sc.MENU_EVENT.SKILL_SHOW_EFFECT_SWAP && this._showEffect(d));
    }
});
sc.CircuitSwapBranches2.Button = ig.FocusGui.extend({
    gfx: new ig.Image("media/gui/circuit.png"),
    submitSound: null,
    blockedSound: null,
    startUID: -1,
    element: -1,
    init: function (a, d, f, g) {
        this.parent();
        this.setSize(45, 45);
        this.setPos(a, d);
        this.startUID = f || -1;
        this.element = g || 0;
        this.submitSound = cachedRingMenuPos;
        this.blockedSound = sc.BUTTON_SOUND.denied;
    },
    updateDrawables: function () {
        if (sc.menu.skillState != sc.MENU_SKILL_STATE.SWAP_BRANCHES)
            return false;
    },
    onButtonPress: function () {
        if (ig.interact.isBlocked())
            return false;
        if (this.startUID < 0)
            ig.warn("skill UID is not valid: " + this.startUID);
        else {
            for (var a = sc.skilltree.getSkill(this.startUID).type == sc.SKILL_STATES.OR_BRANCH_FIRST,
                b = false, d = 0; d < 6; d++)
                if (sc.model.player2.hasSkill(this.startUID + d)) {
                    b = true;
                    break;
                }
            var g = -1;
            if (sc.model.player2.hasSkill(this.startUID)) {
                g = this.startUID + 1;
                a = false;
            } else
                sc.model.player2.hasSkill(this.startUID + 1) ? g = this.startUID : b = false;
            if (b && g >= 0) {
                this.submitSound && this.submitSound.play();
                sc.model.player2.switchBranch(g, a);
                if (window.IG_GAME_DEBUG) {
                    console.groupCollapsed("%cSwitched Branch: ", "color:#00CC00");
                    console.groupCollapsed("%cNew BranchIndices: %c[%i, %i, %i]", "color:#00CC00", "", g, g + 2, g + 4);
                    for (d =
                        0; d < 3; d++)
                        ig.log("%c [%i]: %c" + sc.skilltree.getSkill(g + d * 2).getName(), "color:#00CC00", g + d * 2, "");
                    console.groupEnd();
                    g = g + (a ? 1 : -1);
                    console.groupCollapsed("%cOld BranchIndices: %c[%i, %i, %i]", "color:#00CC00", "", g, g + 2, g + 4);
                    for (d = 0; d < 3; d++)
                        ig.log("%c [%i]: %c" + sc.skilltree.getSkill(g + d * 2).getName(), "color:#00CC00", g + d * 2, "");
                    console.groupEnd();
                    console.groupEnd();
                }
                sc.menu.showSwapSkillEffect(this);
            } else
                this.blockedSound && this.blockedSound.play();
        }
    },
    isMouseOver: function () {
        if (ig.interact.isBlocked() || sc.menu.skillState !=
            sc.MENU_SKILL_STATE.SWAP_BRANCHES)
            return false;
        if (ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD) {
            var b = this.getDistanceToCursor();
            if (sc.menu.skillSwapMoved) {
                sc.menu.unfocusSwapCursor(this);
                return false;
            }
            if (b <= 16) {
                sc.menu.focusSwapCursor(this.hook.pos.x + 22, this.hook.pos.y + 22, this);
                return true;
            }
            sc.menu.unfocusSwapCursor(this);
        } else if (ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE) {
            var b = Math.floor(this.hook.screenCoords.x),
                d = Math.floor(this.hook.screenCoords.y),
                f = Math.floor(sc.control.getMouseX()),
                g = Math.floor(sc.control.getMouseY());
            (b = Math.abs(f - (a + b)) + Math.abs(g - (a + d)) <= a) ? sc.menu.focusSwapCursor(this.hook.pos.x + 22, this.hook.pos.y + 22, this) : sc.menu.unfocusSwapCursor(this);
            return b;
        }
        return false;
    },
    getDistanceToCursor: function () {
        return Math.floor(Vec2.distanceC(sc.menu.skillSwapCursor.x, sc.menu.skillSwapCursor.y, this.hook.pos.x + Math.floor(this.hook.size.x / 2), this.hook.pos.y + Math.floor(this.hook.size.y / 2)));
    }
});
sc.CircuitSwapBranchesInfoBox2 = ig.GuiElementBase.extend({
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.1,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0,
                scaleX: 1,
                scaleY: 0
            },
            time: 0.1,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    gfx: new ig.Image("media/gui/menu.png"),
    buttonGroup: null,
    currentFocus: null,
    leftContent: null,
    rightContent: null,
    arrow: null,
    branches: {
        left: [null, null, null],
        right: [null, null, null]
    },
    _scrollHook: null,
    delta: Vec2.createC(-1, -1),
    init: function (a) {
        this.parent(sc.MenuPanelType.TOP_RIGHT_EDGE);
        this.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_CENTER);
        this.setPos(5, 0);
        this.setSize(150, 209);
        this.setPivot(0, 104.5);
        this.hook.invisibleUpdate = true;
        this.buttonGroup = a;
        this.leftContent = new sc.MenuPanel(sc.MenuPanelType.BOTTOM_LEFT_EDGE);
        this.leftContent.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: 75
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.leftContent.setSize(150, 77);
        this.leftContent.doStateTransition("HIDDEN", true);
        this.addChildGui(this.leftContent);
        this.leftContent.annotation = {
            content: {
                title: "sc.gui.menu.help.circuit.titles.branch",
                description: "sc.gui.menu.help.circuit.description.branch"
            },
            offset: {
                x: 0,
                y: -1
            },
            size: {
                x: 150,
                y: 77
            },
            index: {
                x: 1,
                y: 1
            }
        };
        this.rightContent = new sc.MenuPanel(sc.MenuPanelType.TOP_LEFT_EDGE);
        this.rightContent.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: 75
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.rightContent.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
        this.rightContent.setSize(150, 77);
        this.rightContent.doStateTransition("HIDDEN",
            true);
        this.addChildGui(this.rightContent);
        this.rightContent.annotation = {
            content: {
                title: "sc.gui.menu.help.circuit.titles.branch",
                description: "sc.gui.menu.help.circuit.description.branch"
            },
            offset: {
                x: 0,
                y: -1
            },
            size: {
                x: 150,
                y: 77
            },
            index: {
                x: 1,
                y: 0
            }
        };
        this.arrow = new ig.ImageGui(this.gfx, 576, 224, 23, 20);
        this.arrow.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);
        this.arrow.hook.transitions = {
            DOWN: {
                state: {},
                time: 0.1,
                timeFunction: KEY_SPLINES.LINEAR
            },
            DOWN_INACTIVE: {
                state: {},
                time: 0.05,
                timeFunction: KEY_SPLINES.LINEAR
            },
            UP: {
                state: {
                    angle: Math.PI
                },
                time: 0.1,
                timeFunction: KEY_SPLINES.LINEAR
            },
            UP_INACTIVE: {
                state: {
                    angle: Math.PI
                },
                time: 0.1,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    scaleX: 0,
                    scaleY: 0,
                    angle: -Math.PI / 2
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.arrow.doStateTransition("HIDDEN", true);
        this.addChildGui(this.arrow);
        for (var a = 2, b = 0; b < 3; b++) {
            this.branches.left[b] = new sc.CircuitSwapBranchesInfoBox2.Skill;
            this.branches.left[b].setPos(0, a);
            this.branches.right[b] = new sc.CircuitSwapBranchesInfoBox2.Skill;
            this.branches.right[b].setPos(0, a);
            this.leftContent.addChildGui(this.branches.left[b]);
            this.rightContent.addChildGui(this.branches.right[b]);
            a = a + 24;
        }
        this.doStateTransition("DEFAULT", true);
    },
    setContent: function (a) {
        this.currentFocus = sc.menu.skillSwapFocus;
        if (!this.currentFocus || a) {
            a = "UP_INACTIVE";
            this.arrow.hook.currentStateName == "DOWN" && (a = "DOWN_INACTIVE");
            this.arrow.doStateTransition(a, false, false, function () {
                for (var a = 0; a < 3; a++) {
                    this.branches.left[a].setContent(null, -1, false, 0.05);
                    this.branches.right[a].setContent(null,
                        -1, false, 0.05);
                }
                this.arrow.offsetY = 245;
            }
                .bind(this), 0.05);
        } else {
            this.arrow.hook.stateCallback = null;
            var a = this.currentFocus.startUID,
                b = sc.model.player2;
            sc.skilltree.getSkill(a);
            var d = null,
                g = 0,
                h = this.branches.left,
                i = this.branches.right,
                j = b.hasSkill(a) ? true : false,
                k = false;
            if (!b.hasSkill(a) && !b.hasSkill(a + 1)) {
                this.arrow.offsetY = 245;
                j = true;
            } else {
                this.arrow.offsetY = 224;
                k = true;
            }
            for (b = 0; b < 6; b = b + 2) {
                d = sc.skilltree.getSkill(a + b);
                h[g].setContent(d, a + b, j, k);
                d = sc.skilltree.getSkill(a + (b + 1));
                i[g].setContent(d, a + (b + 1),
                    !j, k);
                g++;
            }
            this.arrow.doStateTransition(!j ? "UP" : "DOWN");
            this.doStateTransition("DEFAULT");
        }
    },
    showMenu: function () {
        this.setContent();
        this.leftContent.doStateTransition("DEFAULT");
        this.rightContent.doStateTransition("DEFAULT");
        this.arrow.doStateTransition("DOWN");
    },
    hideMenu: function () {
        this.leftContent.doStateTransition("HIDDEN");
        this.rightContent.doStateTransition("HIDDEN");
        this.arrow.doStateTransition("HIDDEN");
    },
    modelChanged: function (a, b) {
        a == sc.menu ? b == sc.MENU_EVENT.SKILL_ENTER_SWAP_BRANCHES ? this.showMenu() :
            b == sc.MENU_EVENT.SKILL_LEAVE_SWAP_BRANCHES ? this.hideMenu() : b == sc.MENU_EVENT.SKILL_SWAP_FOCUS ? this.buttonGroup.isActive() && this.setContent() : b == sc.MENU_EVENT.SKILL_SWAP_UNFOCUS && this.buttonGroup.isActive() && this.setContent(true) : a == sc.model.player2 && this.buttonGroup.isActive() && b == sc.PLAYER_MSG.SKILL_BRANCH_SWAP && this.setContent();
    },
    addObservers: function () {
        sc.Model.addObserver(sc.menu, this);
        sc.Model.addObserver(sc.model.player2, this);
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.menu, this);
        sc.Model.removeObserver(sc.model.player2,
            this);
    }
});
sc.CircuitSwapBranchesInfoBox2.Skill = ig.GuiElementBase.extend({
    transitions: {
        DEFAULT: {
            state: {},
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HALF: {
            state: {
                alpha: 0.5
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        },
        HIDDEN: {
            state: {
                alpha: 0
            },
            time: 0.2,
            timeFunction: KEY_SPLINES.LINEAR
        }
    },
    icons: new ig.Image("media/gui/circuit-icons.png"),
    text: null,
    skill: -1,
    init: function () {
        this.parent();
        this.setSize(150, 25);
        this.text = new sc.TextGui("\\c[4]---------------\\c[0]");
        this.text.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0,
                    offsetX: 10
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.text.setPos(32, 4);
        this.addChildGui(this.text);
    },
    setContent: function (a, b, d, g) {
        this.skill = b;
        var h = a ? a.getNameAlt() : "\\c[4]---------------\\c[0]";
        sc.model.player2.hasSkill(b) ? a instanceof sc.SpecialSkill ? h = "\\c[3]" + h + "\\c[0]" : a || (h = "\\c[4]---------------\\c[0]") : h = g && a instanceof sc.SpecialSkill ? "\\c[3]" + h + "\\c[0]" : "\\c[4]" + h + "\\c[0]";
        this.text.setText(h);
        a ? this.doStateTransition(d ? "DEFAULT" :
            "HALF") : this.doStateTransition("HALF", true);
    },
    updateDrawables: function (a) {
        var b = 3;
        if (this.skill >= 0)
            b = sc.skilltree.getSkill(this.skill).icon;
        a.addGfx(this.icons, 4, 0, b % 10 * 24, Math.floor(b / 10) * 24, 24, 24);
    }
});

sc.CircuitMenuAlt = sc.BaseMenu.extend({
    overview: null,
    points: null,
    detail: null,
    info: null,
    node: null,
    swap: null,
    bg: null,
    swapInfo: null,
    hotkeySwap: null,
    hotkeyHelp: null,
    helpGui: null,
    init: function () {
        this.parent();
        this.hook.size.x = ig.system.width;
        this.hook.size.y = ig.system.height;
        this.bg = new ig.ColorGui("black", ig.system.width, ig.system.height);
        this.bg.hook.transitions = {
            DEFAULT: {
                state: {
                    alpha: 0.2
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.bg.doStateTransition("HIDDEN", true);
        this.addChildGui(this.bg);
        this.overview = new sc.CircuitOverviewMenu2;
        this.addChildGui(this.overview);
        this.detail = new sc.CircuitTreeDetailContainer2;
        this.addChildGui(new sc.DummyContainer(this.detail));
        this.info = new sc.CircuitInfoBox2(this.detail.hook);
        this.addChildGui(this.info);
        this.points = new sc.CrossPointsOverview2;
        this.addChildGui(this.points);
        this.node = new sc.CircuitNodeMenu2(this.detail.hook);
        this.node.setPos(100, 100);
        this.addChildGui(this.node);
        this.swap = new sc.CircuitSwapBranches2;
        this.addChildGui(this.swap);
        this.swapInfo = new sc.CircuitSwapBranchesInfoBox2(this.swap.buttonGroup);
        this.addChildGui(this.swapInfo);
        this.hotkeyHelp = new sc.ButtonGui("\\i[help]" + ig.lang.get("sc.gui.menu.hotkeys.help"), void 0, true, sc.BUTTON_TYPE.SMALL);
        this.hotkeyHelp.keepMouseFocus = true;
        this.hotkeyHelp.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    offsetY: -this.hotkeyHelp.hook.size.y
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.hotkeyHelp.onButtonPress = this._onHelpButtonPressed.bind(this);
        this.hotkeySwap = new sc.ButtonGui("\\i[help2]" + ig.lang.get("sc.gui.menu.hotkeys.swap-branches"),
            void 0, true, sc.BUTTON_TYPE.SMALL);
        this.hotkeySwap.keepMouseFocus = true;
        this.hotkeySwap.hook.transitions = {
            DEFAULT: {
                state: {},
                time: 0.2,
                timeFunction: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    offsetY: -this.hotkeySwap.hook.size.y
                },
                time: 0.2,
                timeFunction: KEY_SPLINES.LINEAR
            }
        };
        this.hotkeySwap.onButtonPress = this._onSwapButtonPressed.bind(this);
        this.doStateTransition("DEFAULT", true);
    },
    _onBackButtonPress: function () {
        sc.menu.popBackCallback();
        sc.menu.popMenu();
    },
    _onHelpButtonCheck: function () {
        return sc.control.menuHotkeyHelp();
    },
    _onHelpButtonPressed: function () {
        sc.menu.removeHotkeys();
        this.createHelpGui();
        ig.gui.addGuiElement(this.helpGui);
        this.helpGui.openMenu();
    },
    createHelpGui: function () {
        if (!this.helpGui) {
            this.helpGui = new sc.HelpScreen(this, ig.lang.get("sc.gui.menu.help-texts.circuit.title"), ig.lang.get("sc.gui.menu.help-texts.circuit.pages"), function () {
                this.commitHotKeysToTopBar(true);
            }
                .bind(this), true);
            this.helpGui.hook.zIndex = 15E4;
            this.helpGui.hook.pauseGui = true;
        }
    },
    _onSwapButtonCheck: function () {
        return sc.control.menuHotkeyHelp2();
    },
    _onSwapButtonPressed: function () {
        var b = sc.menu.skillState;
        if (b == sc.MENU_SKILL_STATE.SWAP_BRANCHES) {
            this.hotkeySwap.setText("\\i[help2]" + ig.lang.get("sc.gui.menu.hotkeys.swap-branches"));
            sc.menu.updateHotkeys();
            sc.menu.leaveSwapBranches();
        } else {
            if (b != sc.MENU_SKILL_STATE.OVERVIEW) {
                if (b == sc.MENU_SKILL_STATE.NODE_MENU) {
                    sc.menu.exitNodeMenu();
                    b = sc.MENU_SKILL_STATE.DETAIL_VIEW;
                }
                ig.interact.setBlockDelay(0.2);
                this.detail.trees[sc.menu.currentSkillTree]._onBackButtonPress();
            }
            sc.menu.enterSwapBranches(b);
            this.overview.updateAllBuffers();
            this.hotkeySwap.setText("\\i[help2]" + ig.lang.get("sc.gui.menu.hotkeys.swap-exit"));
            sc.menu.updateHotkeys();
            this.bg.doStateTransition("DEFAULT");
        }
    },
    _addHotKeys: function (b) {
        sc.menu.buttonInteract.addGlobalButton(this.hotkeyHelp, this._onHelpButtonCheck.bind(this));
        sc.menu.buttonInteract.addGlobalButton(this.hotkeySwap, this._onSwapButtonCheck.bind(this));
        this.commitHotKeysToTopBar(b);
    },
    commitHotKeysToTopBar: function (b) {
        sc.menu.addHotkey(function () {
            return this.hotkeySwap;
        }
            .bind(this));
        sc.menu.addHotkey(function () {
            return this.hotkeyHelp;
        }
            .bind(this));
        sc.menu.commitHotkeys(b);
    },
    addObservers: function () {
        sc.Model.addObserver(sc.model.menu, this);
        this.overview.addObservers();
        this.points.addObservers();
        this.info.addObservers();
        this.node.addObservers();
        this.detail.addObservers();
        this.swap.addObservers();
        this.swapInfo.addObservers();
    },
    removeObservers: function () {
        sc.Model.removeObserver(sc.model.menu, this);
        this.overview.removeObservers();
        this.points.removeObservers();
        this.info.removeObservers();
        this.node.removeObservers();
        this.detail.removeObservers();
        this.swap.removeObservers();
        this.swapInfo.removeObservers();
    },
    showMenu: function () {
        this.addObservers();
        sc.menu.pushBackCallback(this._onBackButtonPress.bind(this));
        sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.HIDDEN);
        ig.interact.setBlockDelay(0.2);
        this._addHotKeys();
        this.overview.showMenu();
        this.points.showMenu();
    },
    hideMenu: function () {
        sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.LARGE);
        this.exitMenu();
    },
    exitMenu: function () {
        this.removeObservers();
        sc.menu.buttonInteract.removeGlobalButton(this.hotkeyHelp);
        sc.menu.buttonInteract.removeGlobalButton(this.hotkeySwap);
        this.helpGui = null;
        if (sc.menu.currentSkillTree == -1) {
            this.overview.exitMenu();
            this.points.exitMenu();
            this.swapInfo.hideMenu();
        } else {
            this.overview.exitMenu(true);
            this.detail.exitMenu();
            this.points.removeHotkeys();
        }
    },
    modelChanged: function (b, a) {
        if (b == sc.menu)
            if (a == sc.MENU_EVENT.SKILL_TREE_SELECT) {
                if (sc.menu.previousSkillTree != sc.menu.currentSkillTree) {
                    sc.menu.currentSkillTree == -1 ? this.overview.leaveDetailView() : this.overview.enterDetailView();
                    this.detail.switchElementTree(sc.menu.currentSkillTree, sc.menu.previousSkillTree);
                }
            } else if (a ==
                sc.MENU_EVENT.SKILL_LEAVE_SWAP_BRANCHES) {
                this.hotkeySwap.setText("\\i[help2]" + ig.lang.get("sc.gui.menu.hotkeys.swap-branches"));
                sc.menu.updateHotkeys();
                this.overview.updateAllBuffers();
                this.bg.doStateTransition("HIDDEN");
            }
    }
});

sc.StatusMenu.inject({
    onEquipButtonPressed: function () {
        if (sc.menu.previousMenu == sc.MENU_SUBMENU.START)
            sc.menu.pushMenu(sc.MENU_SUBMENU.EQUIPMENT_ALT);
        else if (sc.menu.previousMenu == sc.MENU_SUBMENU.EQUIPMENT_ALT)
            this.onBackButtonPress();
    },
});

sc.MENU_SUBMENU.EQUIPMENT_ALT = 22;
sc.MENU_SUBMENU.SKILLS_ALT = 23;

sc.SUB_MENU_INFO[sc.MENU_SUBMENU.SKILLS_ALT] = {
    Clazz: sc.CircuitMenuAlt,
    name: "skillsAlt"
};

sc.SUB_MENU_INFO[sc.MENU_SUBMENU.EQUIPMENT_ALT] = {
    Clazz: sc.EquipMenu2,
    name: "equipment2"
};

sc.MenuModel.inject({
    isSkills: function () {
        return this.currentMenu == sc.MENU_SUBMENU.SKILLS || sc.MENU_SUBMENU.SKILLS_ALT;
    },
    isEquipment: function () {
        return this.currentMenu == sc.MENU_SUBMENU.EQUIPMENT || sc.MENU_SUBMENU.EQUIPMENT_ALT;
    },
});

sc.GameModel.inject({
    emilieConfig: new sc.PlayerConfig("Emilie"),
    player2: null,
    init() {
        this.parent();
        this.player2 = new sc.PlayerModelTwo;
        this.player2.setConfig(this.emilieConfig);
    },

    onReset() {
        this.player2.setConfig(this.emilieConfig);
        this.player2.reset();
        this.parent();
    }
});


ig.ACTION_STEP.GIVE_ITEM_ALT = ig.ActionStepBase.extend({
    item: 0,
    amount: 0,
    skip: false,
    _wm: new ig.Config({
        attributes: {
            item: {
                _type: "Item",
                _info: "The item to spawn."
            },
            amount: {
                _type: "NumberExpression",
                _info: "Amount of the given item. 0 = 1.",
                _default: 1
            },
            skip: {
                _type: "Boolean",
                _info: "True if the side gui should hide the obtained item",
                _default: false
            }
        },
        label: function () {
            return "<b>GIVE ITEM: </b> <em>" + wmPrint("Item", this.item) + "</em> x" + this.amount + (this.skip ? "  <i>+ Skip Display</i>" : "");
        }
    }),
    init: function (a) {
        this.item = a.item || 0;
        this.amount = a.amount || 1;
        this.skip = a.skip || false;
    },
    start: function () {
        var a = ig.Event.getExpressionValue(this.amount);
        sc.model.player2.addItem(this.item,
            a, this.skip);
    }
});
ig.ACTION_STEP.ADD_CP_ALT = ig.ActionStepBase.extend({
    element: null,
    amount: 0,
    _wm: new ig.Config({
        attributes: {
            element: {
                _type: "String",
                _info: "Element that gets the CP",
                _select: sc.ELEMENT
            },
            amount: {
                _type: "NumberExpression",
                _info: "Amount of CP to give.",
                _default: 1
            }
        },
        label: function () {
            return "<b>ADD CP: </b> <em>" + wmPrint("Element", this.element) + "</em> x" + this.amount;
        }
    }),
    init: function (a) {
        this.element = sc.ELEMENT[a.element] || sc.ELEMENT.NEUTRAL;
        this.amount = a.amount || 1;
    },
    start: function () {
        var a = ig.Event.getExpressionValue(this.amount);
        sc.model.player2.addSkillPoints(a, this.element, false, true);
    }
});

sc.Combat.inject({
    onCombatantDeathHit: function (a, b) {
        var c = sc.pvp.onPvpCombatantDefeat(b);
        c && a && this.doDramaticEffect(a, b, c, true);
        if (b.isPlayer && !b.manualKill && !sc.pvp.isActive()) {
            c = ig.vars.get("stats.deaths") || 0;
            ig.game.respawn();
            ig.vars.set("stats.deaths", c + 1);
        } else if (b.isPlayer2 && !b.manualKill && !sc.pvp.isActive()) {
            c = ig.vars.get("stats.deaths") || 0;
            ig.game.respawn();
            ig.vars.set("stats.deaths", c + 1);
        } else if (b.party == sc.COMBATANT_PARTY.ENEMY) {
            c = false;
            sc.arena.onCombatantDeathHit(a, b);
            if (this.finalDramaticEffect) {
                for (var d = this.activeCombatants[b.party], e = 0, f = d.length; f--;) {
                    var g = d[f];
                    (!g.params ||
                        !g.params.isDefeated()) && e++;
                }
                if (e == 0) {
                    if (!c && a) {
                        this.doDramaticEffect(a || b, b, this.finalDramaticEffect, true);
                        c = true;
                    }
                    if (this.finalDramaticEffect.arena)
                        sc.arena.onFinalDeathHit();
                    this.finalDramaticEffect = null;
                }
            }
            if (!sc.pvp.isActive()) {
                e = sc.model.increaseCombatRank(1 * b.enemyType.enduranceScale);
            }
            d = b.getAlignedPos(ig.ENTITY_ALIGN.CENTER, m);
            if (e) {
                if (sc.model.isSRank() && sc.options.get("s-rank-effects")) {
                    c = this.effects.combat.spawnFixed("rankS", d.x, d.y, d.z);
                    c.setIgnoreSlowdown();
                    this.doDramaticEffect(a, b, sc.DRAMATIC_EFFECT.S_RANK,
                        true);
                } else {
                    e = "rank" + sc.model.getCombatRankLabel();
                    this.effects.combat.spawnFixed(e, d.x, d.y, d.z);
                    c || this.doDramaticEffect(a || b, b, sc.DRAMATIC_EFFECT.RANK_UP);
                }
                c = ig.lang.get("sc.gui.combat-msg.rank-up") + " " + sc.model.getCombatRankLabel();
                c = new sc.SmallEntityBox(b, c, 2);
                ig.gui.addGuiElement(c);
            } else if (sc.model.isSRank() && sc.options.get("s-rank-effects")) {
                c = this.effects.combat.spawnFixed("sRankKill", d.x, d.y, d.z);
                c.setIgnoreSlowdown();
            }
        }
    },
    doDramaticEffect: function (a, b, c, d) {
        if (c.label) {
            var e = ig.lang.get(c.label);
            this.showCombatantLabel(b, e);
        }
        a || (a = b);
        b || (b = a);
        e = [];
        d = d || a.isPlayer || a.isPlayer2 || c.alwaysFocus;
        c.speedlines && sc.options.get("speedlines") && e.push({
            type: "SHOW_EFFECT",
            entity: b,
            align: "CENTER",
            effect: {
                sheet: "speedlines",
                name: "speedlinesDramatic"
            },
            duration: c.wait + (c.earlyCameraOut || 0) - (c.cameraOutOverlap || 0) + 0.05,
            ignoreSlowMo: true
        });
        if (d) {
            e.push({
                type: "ADD_SLOW_MOTION",
                name: "levelUp",
                factor: c.timeFactor,
                time: c.timeFadeIn || 0
            });
            c.camera == 1 && e.push({
                type: "SET_CAMERA_TARGET",
                entity: b,
                speed: 0.1,
                transition: "EASE_OUT",
                zoom: c.zoom || 1
            });
            c.camera == 2 && e.push({
                type: "SET_CAMERA_BETWEEN",
                entity1: a,
                entity2: b,
                speed: 0.1,
                transition: "EASE_OUT",
                zoom: c.zoom || 1
            });
        }
        c.blurDuration && e.push({
            type: "SET_ZOOM_BLUR",
            zoomType: c.blurType || "MEDIUM",
            fadeIn: 0.1,
            duration: c.blurDuration,
            fadeOut: 0.2,
            target: b
        });
        e.push({
            type: "WAIT",
            time: c.wait,
            ignoreSlowDown: true
        });
        if (c.earlyCameraOut && c.camera) {
            e.push({
                type: "SET_CAMERA_ZOOM",
                zoom: 1,
                duration: c.earlyCameraOut,
                transition: "EASE_IN_OUT"
            });
            e.push({
                type: "WAIT",
                time: c.earlyCameraOut - c.cameraOutOverlap,
                ignoreSlowDown: true
            });
        }
        if (d) {
            e.push({
                type: "CLEAR_SLOW_MOTION",
                name: "levelUp",
                time: c.clearTime
            });
            c.camera && e.push({
                type: "UNDO_CAMERA",
                speed: c.cameraBackTime || 1,
                transition: "EASE_IN_OUT",
                wait: true
            });
        }
        a = new ig.Event({
            steps: e
        });
        ig.game.events.callEvent(a, ig.EventRunType.INTERRUPTABLE);
    },
});

sc.PvpModel.inject({
    onPvpCombatantDefeat: function (b) {
        if (!this.isActive())
            return false;
        if (b.party == sc.COMBATANT_PARTY.PLAYER) {
            if (sc.party.isDefeated())
                return this.showKO(sc.COMBATANT_PARTY.ENEMY);
        } else {
            if (this.enemies.indexOf(b) == -1)
                return false;
            for (var b = true, a = this.enemies.length; a--;)
                this.enemies[a].isDefeated() || (b = false);
            if (ig.vars.get("tmp.playerOppose")) {
                if (b || ig.game.player2Entity.isDefeated())
                    return this.showKO(sc.COMBATANT_PARTY.PLAYER);
            }
            else {
                if (b)
                    return this.showKO(sc.COMBATANT_PARTY.PLAYER);
            }
        }
    },
    onPostKO: function (b) {
        var a = b == sc.COMBATANT_PARTY.ENEMY ? 1 : 0.5,
            b = b == sc.COMBATANT_PARTY.ENEMY ? 0.5 : 1;
        if (ig.vars.get("tmp.playerOppose")) {
            ig.game.player2Entity.regenPvp(a);
        }
        else {
            ig.game.player2Entity.regenPvp(b);
        }
        ig.game.playerEntity.regenPvp(a);
        for (var d = sc.party.getPartySize(); d--;)
            sc.party.getPartyMemberEntityByIndex(d).regenPvp(a);
        for (d = this.enemies.length; d--;)
            this.enemies[d].regenPvp(b);
        this.state = this.isOver() ? 5 : 4;
        ig.game.varsChangedDeferred();
    },
    onPostUpdate: function () {
        if (this.state ==
            3) {
            var b = true;
            ig.game.playerEntity.dying != sc.DYING_STATE.DYING && (b = false);
            if (!ig.vars.get("tmp.playerOppose")) {
                ig.game.player2Entity.dying != sc.DYING_STATE.DYING && (b = false);
            }
            for (var a = sc.party.getPartySize(); a--;)
                sc.party.getPartyMemberEntityByIndex(a).dying || (b = false);
            for (var d = true, a = this.enemies.length; a--;)
                if (ig.vars.get("tmp.playerOppose")) {
                    ig.game.player2Entity.dying != sc.DYING_STATE.DYING && (d = false);
                }
            this.enemies[a].dying != sc.DYING_STATE.DYING && (d = false);
            if (b || d)
                this.onPostKO(b ? sc.COMBATANT_PARTY.ENEMY : sc.COMBATANT_PARTY.PLAYER);
        }
    },
});

ig.ENTITY.Combatant.inject({
    quickFall: function (a) {
        if (!this.respawn.timer && (!this.params || !this.params.isDefeated() || this.isPlayer || this.isPlayer2 && this.manualKill))
            if (!this.onFallBehavior || !this.onFallBehavior(a)) {
                var b = this.getAlignedPos(ig.ENTITY_ALIGN.BOTTOM, d);
                this.animState.alpha = 0;
                ig.EntityTools.isInScreen(this) || (a = ig.TERRAIN[sc.map._oobSoundTerrain]);
                a == ig.TERRAIN.HOLE ? this.effects.death.spawnFixed("hole_fall", b.x, b.y, b.z) : a == ig.TERRAIN.WATER ? this.effects.death.spawnFixed("waterSplash", b.x, b.y, b.z) : a == ig.TERRAIN.HIGHWAY ?
                    this.effects.death.spawnFixed("hole_fall", b.x, b.y, b.z) : a == ig.TERRAIN.COAL && this.effects.death.spawnFixed("coalBurn", b.x, b.y, b.z);
                b = 0;
                if (this.params) {
                    sc.combat.isDamageIgnore() || (b = Math.floor(this.params.getStat("hp") * this.fallDmgFactor));
                    this.cancelAction();
                }
                this.doQuickRespawn(a, false, b);
            }
    },
});

{
    //Only adds PLAYER_2 to u

    var u = {
        PLAYER: function () {
            return ig.game.playerEntity;
        },
        PLAYER_2: function () { //<---- Only change here
            return ig.game.player2Entity;
        },
        PARTY_0: function () {
            return sc.party.getPartyMemberEntityByIndex(0, true);
        },
        PARTY_1: function () {
            return sc.party.getPartyMemberEntityByIndex(1, true);
        },
        COLLAB_ENTITY: function (a) {
            return a.collabAttribs && a.collabAttribs.entity;
        },
        COLLAB_LABELED_ENTITY: function (a, b) {
            return a.collaboration ? a.collaboration.getLabeledParticipant(b) :
                null;
        },
        CLOSEST_ENEMY: function (a) {
            for (var b = a.getAlignedPos(ig.ENTITY_ALIGN.BOTTOM, j), c = Math.PI * 0.5, b = ig.game.getEntitiesInCircle(b, ig.system.width / 2, 1, 32, a.face, -c / 2, c / 2, a), c = null, d = 0, e = b.length; e--;) {
                var f = b[e];
                if (f instanceof ig.ENTITY.Combatant && f.party != a.party) {
                    var g = ig.CollTools.getDistVec2(a.coll, f.coll, r),
                        h = Vec2.angle(a.face, g),
                        g = Vec2.length(g) + h * 1E3;
                    if (!c || g < d) {
                        c = f;
                        d = g;
                    }
                }
            }
            return c;
        },
        GUARDED_ATTACKER: function (a) {
            a = a.combo.guardedEntity;
            return !a || a.isBall ? null : a.getCombatant();
        },
        FIRST_HIT: function (a) {
            return a.combo.hitCombatants[0];
        },
        PROXY_OWNER: function (a) {
            return a.getCombatantRoot();
        },
        ENEMY_OWNER: function (a) {
            return a.getCombatantRoot().ownerEnemy;
        },
        ENEMY_OWNER_ACTION_PROXY: function (b, c) {
            if (!b.getCombatantRoot().ownerEnemy)
                return null;
            var d = b.getCombatantRoot().ownerEnemy.actionAttached;
            return a(d, c);
        },
        PROXY_SRC: function (a) {
            return a.sourceEntity;
        },
        ACTION_PROXY: function (b, c) {
            return a(b.actionAttached, c);
        },
        PROXY: function (b, c) {
            return a(b.entityAttached, c);
        },
        PROXY_OWNER_ACTION_PROXY: function (b, c) {
            var d = b.getCombatantRoot().actionAttached;
            return a(d, c);
        },
        PROXY_SRC_ACTION_PROXY: function (b, c) {
            return a(b.sourceEntity.actionAttached, c);
        },
        NAMED_ENTITY: function (a, b) {
            return ig.game.namedEntities[b];
        },
        ATTRIB_ENTITY: function (a, b) {
            return ig.Event.getEntity(a.getAttribute(b));
        },
        THREAT: function (a) {
            return a.threat;
        },
        ENTITY_VIA_ID: function (a, b) {
            return ig.game.entities[b];
        },
        PART_TARGET_ROOT: function (a) {
            a = a.getTarget();
            return a instanceof sc.CombatantAnimPartEntity ? a.getCombatantRoot() : a;
        }
    };
    ig.ACTION_STEP.SET_TEMP_TARGET = ig.ActionStepBase.extend({
        _wm: new ig.Config({
            attributes: {
                kind: {
                    _type: "String",
                    _info: "Kind of temp target",
                    _select: u
                },
                key: {
                    _type: "StringExpression",
                    _info: "Additional String key to fetch named entities etc.",
                    _optional: true
                }
            }
        }),
        init: function (a) {
            this.kind = u[a.kind] || u.PLAYER;
            this.key = a.key;
        },
        start: function (a) {
            var b = ig.Event.getExpressionValue(this.key),
                b = this.kind(a, b);
            if (a instanceof sc.BasicCombatant)
                a.tmpTarget = b;
        }
    });
}

sc.MapInteract.inject({
    onPreUpdate: function () {
        var g = !sc.control.interactDown(),
            j = true;

        if (!ig.game.paused) {
            this.updateHideStatus();
            if (this.hidden) {
                g = true;
                j = false;
            }

            var players = [
                ig.game.playerEntity,
                ig.game.player2Entity
            ];
            var anyPlayerNear = false; // Track if any player is near
            var allPlayersFar = true; // Track if all players are far
            var f = Vec2.create(),
                c = Vec2.create(),
                e = Vec2.create();

            players.forEach(function (player) {
                if (player) {
                    player.getCenter(f);
                    if (this.interacting && this.focusEntry) {
                        if (g) {
                            if (this.focusEntry.handler.onInteractionEnd)
                                this.focusEntry.handler.onInteractionEnd();
                            this.focusEntry = null;
                            this.interacting = false;
                        } else {
                            j = false;
                        }
                    } else {
                        this.focusEntry = null;
                    }
                } else {
                    allPlayersFar = false; // Ensure no action is prematurely triggered if a player is missing
                    g = true;
                    j = false;
                }
            }, this);

            for (var l = this.entries.length, o; l--;) {
                var m = this.entries[l],
                    n = m.entity;
                if (n._killed) {
                    this.removeEntry(m);
                } else if (j) {
                    o = sc.INTERACT_ENTRY_STATE.AWAY;

                    if (m.blockedDuringCombat && sc.model.isCombatActive()) {
                        o = sc.INPUT_FORCER_ENTRIES.HIDDEN;
                    } else if (ig.EntityTools.isInScreen(n, 16)) {
                        players.forEach(function (player) {
                            if (!player) return; // Skip if player does not exist
                            player.getCenter(f);
                            n.getCenter(c);
                            Vec2.sub(c, f, e);
                            var playerNear = false;

                            // Check Z-Condition and distance
                            m.zCondition == sc.INTERACT_Z_CONDITION.SAME_Z
                                ? playerNear = Math.abs(player.coll.pos.z - n.coll.pos.z) <= ig.COLLISION.HEIGHT_TOLERATE
                                : m.zCondition == sc.INTERACT_Z_CONDITION.Z_RANGE_OVERLAP
                                && (playerNear = n.coll.pos.z + n.coll.size.z >= player.coll.pos.z &&
                                    player.coll.pos.z + player.coll.size.z >= n.coll.pos.z);

                            player.coll.pos.z > player.coll.baseZPos && (playerNear = false);

                            var r = Vec2.length(e);
                            if (playerNear && r <= 40 + n.coll.size.y / 2 &&
                                (!m.interrupting || ig.game.isInterruptible() && !sc.model.isMapLeaveBlocked()) &&
                                !player.interactObject) {
                                anyPlayerNear = true;
                                allPlayersFar = false;
                                o = sc.INTERACT_ENTRY_STATE.NEAR;

                                // Check interaction conditions based on player
                                if (player === ig.game.playerEntity) {
                                    if (sc.control.interactPressed() && !ig.interact.isBlocked()) {
                                        this.focusEntry = m;
                                        this.focusEntry.handler.onInteraction && this.focusEntry.handler.onInteraction();
                                        this.interacting = true;
                                    }
                                } else if (player === ig.game.player2Entity) {
                                    if (sc.control.interactPressedAlt() && !ig.interact.isBlocked()) {
                                        this.focusEntry = m;
                                        this.focusEntry.handler.onInteractionAlt && this.focusEntry.handler.onInteractionAlt();
                                        this.interacting = true;
                                    }
                                }
                            }
                        }, this);
                    } else {
                        o = sc.INTERACT_ENTRY_STATE.HIDDEN;
                    }
                    m.setState(o);
                } else {
                    m != this.focusEntry && m.setState(sc.INTERACT_ENTRY_STATE.HIDDEN);
                }
            }

            // End interaction only if all players are far
            if (j && !anyPlayerNear && this.focusEntry) {
                this.focusEntry.setState(sc.INTERACT_ENTRY_STATE.FOCUS);
            }
        }
    },
});
ig.ACTION_STEP.INCREASE_PLAYER_SP_LEVEL_VAR = ig.ActionStepBase.extend({
    _wm: new ig.Config({
        attributes: {}
    }),
    init: function () { },
    start: function () {
        sc.model.player2.setSpLevel(sc.model.player2.spLevel + 1);
    }
});
ig.ACTION_STEP.ADD_PLAYER_EXP_VAR = ig.ActionStepBase.extend({
    exp: 0,
    level: 0,
    _wm: new ig.Config({
        attributes: {
            exp: {
                _type: "NumberExpression",
                _info: "Experience count."
            },
            level: {
                _type: "Number",
                _info: "Level of experience",
                _optional: true
            }
        }
    }),
    init: function (b) {
        this.exp = b.exp;
        this.level = b.level || 0;
    },
    start: function () {
        var b = this.level || sc.model.player2.level,
            a = ig.Event.getExpressionValue(this.exp),
            b = sc.model.player2.addExperience(a, b, void 0, void 0,
                sc.LEVEL_CURVES.STATIC_REGULAR);
        sc.stats.addMap("player", "expOther", b);
    }
});
ig.ACTION_STEP.SET_PLAYER_LEVEL_DEBUG_VAR = ig.ActionStepBase.extend({
    level: null,
    _wm: new ig.Config({
        attributes: {
            level: {
                _type: "Number",
                _info: "New Level of Player"
            }
        }
    }),
    init: function (b) {
        this.level = b.level;
    },
    start: function () {
        var b = Math.max(sc.model.player2.level, this.level);
        sc.model.player2.setLevel(b, true);
        sc.PlayerLevelTools.autoequip(sc.model.player2, sc.model.player2.config.autoequip, 0, b, true, true);
    }
});

ig.ENTITY.NPC.inject({
    onInteractionAlt: function () {
        var a;
        if (!sc.quests.hasSolvedQuestsStacked()) {
            if (this.xenoDialog) {
                if (!this.xenoDialog.getCallbackEvent())
                    return false;
                a = this.xenoDialog.getCallbackEvent();
                this.xenoDialog.onEventStart();
            } else {
                var b = this.npcStates[this.activeStateIdx];
                b.npcEventObj && (a = b.npcEventType == sc.NPC_EVENT_TYPE.TRADE ? b.npcEventObj.event :
                    b.npcEventObj);
            }
            if (a)
                this.eventCall = ig.game.events.callEvent(a, ig.EventRunType.BLOCKING, this.onEventStart.bind(this), this.onEventEnd.bind(this), null, this, {
                    character: this.characterName
                });
        }
    },
});


sc.PlayerLevelNotifierTwo = ig.Class.extend({
    levelUpSound: new ig.Sound("media/sound/battle/level-up.ogg"),
    init: function () { },
    runLevelUpScene: function (b, a, d) {
        b = this.getLevelUpEvent(b, a);
        a.clearLevelUp();
        ig.game.events.callEvent(b, d ? ig.EventRunType.PARALLEL : ig.EventRunType.BLOCKING, this.onLevelUpEventStart.bind(this), this.onLevelUpEventEnd.bind(this));
    },
    onLevelUpEventStart: function () {
        sc.model.enterLevelUp();
    },
    onLevelUpEventEnd: function () {
        sc.model.enterRunning();
        sc.commonEvents.triggerEvent("LEVEL_UP", {
            level: sc.model.player2.level
        });
    },
    getLevelUpEvent: function (b, a) {
        var d = {
            steps: [{
                type: "PLAY_SOUND",
                sound: "media/sound/battle/level-up.ogg",
                volume: 1
            }, {
                type: "DO_ACTION",
                entity: b,
                action: [{
                    type: "WAIT",
                    time: -1
                }
                ]
            }, {
                type: "ADD_SLOW_MOTION",
                name: "levelUp",
                factor: 0,
                time: 0.5
            }, {
                type: "WAIT",
                time: 0.1,
                ignoreSlowDown: true
            }, {
                type: "SET_ENTITY_STATIC_TIME",
                entity: b,
                value: true,
                global: true
            }, {
                type: "DO_ACTION",
                entity: b,
                keepState: true,
                action: [{
                    type: "SHOW_ANIMATION",
                    anim: "levelUpPre",
                    followUp: "levelUpStand"
                }, {
                    type: "WAIT",
                    time: -1
                }
                ]
            }, {
                type: "SET_CAMERA_TARGET",
                entity: b,
                speed: 0.6,
                transition: "EASE_IN_OUT",
                wait: true,
                zoom: 1.5,
                waitSkip: 0.2
            }, {
                type: "ADD_GUI",
                name: null,
                guiInfo: {
                    type: "LevelUpHud",
                    settings: {
                        deltaValues: ig.copy(a.levelUpDelta)
                    }
                }
            }, {
                type: "SET_ZOOM_BLUR",
                zoomType: "MEDIUM",
                fadeIn: 0.1,
                duration: 0.2,
                fadeOut: 0.5
            }, {
                type: "WAIT_UNTIL_TRUE",
                condition: "tmp._levelUpFinished"
            }, {
                type: "DO_ACTION",
                entity: b,
                action: [{
                    type: "SHOW_ANIMATION",
                    anim: "levelUpPreJump"
                }, {
                    type: "WAIT",
                    time: 0.2
                }, {
                    type: "SHOW_ANIMATION",
                    anim: "levelUpJump"
                }, {
                    type: "JUMP",
                    jumpHeight: "M",
                    wait: true,
                    ignoreSounds: true
                }
                ]
            }, {
                type: "WAIT",
                time: 0.5,
                ignoreSlowDown: true
            }, {
                type: "CLEAR_SLOW_MOTION",
                name: "levelUp",
                time: 0.1
            }, {
                type: "SET_ENTITY_STATIC_TIME",
                entity: b,
                value: false,
                global: true
            }
            ]
        };
        return new ig.Event(d);
    }
});

sc.ItemConsumption.inject({
    runItemUseAction: function (b, a, d) {
        if (d && sc.inventory.getItem(d).type == sc.ITEMS_TYPES.CONS) {
            b = this.getAction(d);
            ig.game.playerEntity.setAction(b);
            ig.game.player2Entity.setAction(b);
        }
    },
    activateItemEffect: function (b, a, d) {
        var c = sc.inventory.getItem(d),
            a = c.time || 0;
        c.effect && c.effect.spawnOnTarget && c.effect.spawnOnTarget(b);
        if (c.stats) {
            for (var b = c.stats, c = null, e = b.length, f = false; e--;) {
                c = sc.STAT_CHANGE_SETTINGS[b[e]];
                switch (c.change) {
                    case sc.STAT_CHANGE_TYPE.HEAL:
                        this.runHealChange(c);
                        this.runHealChangeAlt(c);
                        break;
                    case sc.STAT_CHANGE_TYPE.STATS:
                    case sc.STAT_CHANGE_TYPE.MODIFIER:
                        f = true;
                }
            }
            f && this.runStatChange(b, a, d);
            f && this.runStatChangeAlt(b, a, d);
        } else
            throw Error("Use Items must have defined a stats property");
    },
    runHealChangeAlt: function (b) {
        var a = ig.game.player2Entity,
            b = b.value - 1,
            b = b * (1 + a.params.getModifier("ITEM_BOOST")),
            b = new sc.HealInfo(a.params, {
                value: b,
                absolute: false
            });
        a.heal(b);
    },
    runStatChangeAlt: function (b, a, d) {
        sc.model.player2.params.addItemBuff(b, a * (sc.newgame.get("double-buff-time") ? 2 : 1), d);
    },
});
{
    function b(a) {
        for (var b = h.length, c = 0; b--;)
            if (a.time >=
                h[b]) {
                c = b + 1;
                break;
            }
        return c = Math.min(a.maxLevel, c);
    }
    function a(a, b) {
        if (a[b] > 0) {
            a[b] = a[b] - ig.system.tick;
            a[b] <= 0 && (a[b] = 0);
        }
    }
    Vec2.create();
    var d = {
        actionKey: "ATTACK_SPECIAL"
    },
        c = {
            actionKey: "THROW_SPECIAL"
        },
        e = {
            actionKey: "GUARD_SPECIAL"
        },
        f = {
            actionKey: "DASH_SPECIAL"
        },
        g = ["Neutral", "Heat", "Cold", "Shock", "Wave"],
        h = [0.25, 0.5, 1];

    var i = {
        thrown: false,
        melee: false,
        aim: false,
        autoThrow: false,
        attack: false,
        guard: false,
        charge: false,
        dashX: 0,
        dashY: 0,
        switchMode: false,
        relativeVel: 0,
        moveDir: Vec2.create()
    },
        j = {};

    ig.ENTITY.PlayerTwo = sc.PlayerBaseEntity.extend({
        skin: {
            appearanceFx: null,
            appearance: null,
            stepFx: null,
            auraFx: null,
            auraFxHandle: null,
            pet: null
        },
        proxies: null,
        model: null,
        state: 0,
        throwCounter: 0,
        attackCounter: 0,
        attackResetTimer: 0,
        throwDir: Vec2.create(),
        throwDirData: Vec2.create(),
        doAttack: false,
        lastMoveDir: Vec2.create(),
        dashCount: 0,
        dashAttackCount: 0,
        maxDash: 3,
        keepLastMoveDir: 0,
        moveDirStartedTimer: 0,
        jumpPoint: Vec2.create(),
        jumpForwardDir: Vec2.create(),
        idle: {
            timer: 0,
            actions: [],
            petAction: null
        },
        gui: {},
        cameraHandle: null,
        cameraTargets: [],
        mapStartPos: Vec3.create(),
        actionBlocked: {
            action: 0,
            charge: 0,
            dash: 0,
            reaim: 0,
            move: 0
        },
        combatStats: {
            lastTarget: null
        },
        dashDir: Vec2.create(),
        dashDirData: Vec2.create(),
        dashTimer: 0,
        dashBlock: 0,
        doEscapeTimer: 0,
        stunEscapeDash: false,
        dashPerfect: false,
        perfectGuardCooldown: 0,
        charging: {
            time: -1,
            cancelTime: 0,
            swapped: false,
            type: null,
            maxLevel: 0,
            fx: null,
            block: 0,
            msg: null,
            executeLevel: 0,
            prefDir: Vec2.create()
        },
        chargeThrowCharged: false,
        floating: false,
        recordInput: false,
        interactObject: null,
        explicitAimStart: 0,
        levelUpNotifier: null,
        atLandmarkHeal: 0,
        atLandmarkTeleport: 0,
        itemConsumer: null,
        isPlayer2: true,
        hidePets: false,
        init: function (a, b, c, d) {
            this.parent(a, b, c, d);
            this.levelUpNotifier = new sc.PlayerLevelNotifierTwo;
            this.itemConsumer = new sc.ItemConsumption;
            if (sc.model) {
                this.model = sc.model.player2;
                sc.Model.addObserver(this.model, this);
                sc.Model.addObserver(sc.model, this);
                this.initModel();
            }
            sc.Model.addObserver(sc.playerSkins, this);
            this.charging.fx = new sc.CombatCharge(this, true);
            sc.combat.addActiveCombatant(this);
        },
        initModel: function () {
            this.params =
                this.model.params;
            this.params.setCombatant(this);
            this.animSheet = this.animSheetReplace || this.model.animSheet;
            sc.Model.addObserver(this.params, this);
            this.initAnimations();
            this.copyModelSkills();
            this.updateModelStats(true);
            this.updateSkinStepFx();
            this.updateSkinAura();
            this.updateSkinPet(false);
            this.initIdleActions();
        },
        replaceAnimSheet: function (a) {
            this.animSheetReplace = a;
            this.updateAnimSheet();
        },
        initIdleActions: function () {
            this.idle.actions.length = 0;
            if (this.model.name == "Lea") {
                var a = sc.gameCode.isEnabled("caramelldansen") ?
                    new ig.Action("PLAYER_IDLE", [{
                        type: "SET_FACE",
                        face: "SOUTH",
                        rotate: true
                    }, {
                        type: "WAIT",
                        time: 0.3
                    }, {
                        type: "SHOW_EXTERN_ANIM",
                        anim: {
                            sheet: "player-poses",
                            name: "caramelldansen"
                        }
                    }, {
                        type: "WAIT",
                        time: 5
                    }, {
                        type: "SHOW_ANIMATION",
                        anim: "preIdle",
                        wait: true
                    }
                    ], false, false) : new ig.Action("PLAYER_IDLE", [{
                        type: "CHANGE_STAT_MAP_NUMBER",
                        map: "misc",
                        stat: "yawns",
                        value: 1,
                        changeType: "add"
                    }, {
                        type: "SET_FACE",
                        face: "SOUTH_EAST",
                        rotate: true
                    }, {
                        type: "SHOW_ANIMATION",
                        anim: "idleStretch",
                        wait: true
                    }
                    ], false, false);
                this.idle.actions.push(a);
            }
        },
        doPetAction: function () {
            var a = [{
                x: 0,
                y: -7
            }, {
                x: 12,
                y: -1
            }, {
                x: -12,
                y: -1
            }, {
                x: 0,
                y: 7
            }
            ],
                b = this.skin.pet;
            if (b.petSkin.petOffsets)
                a = b.petSkin.petOffsets;
            a = new ig.Action("PLAYER_IDLE", [{
                type: "SET_FACE_TO_ENTITY",
                entity: b,
                rotate: true
            }, {
                type: "WAIT",
                time: 0.4
            }, {
                type: "SET_COLL_TYPE",
                value: "IGNORE"
            }, {
                type: "SET_RELATIVE_SPEED",
                value: 0.3
            }, {
                type: "MOVE_TO_ENTITY_CLOSEST_OFFSET",
                entity: b,
                offsets: a,
                maxTime: 0.4,
                forceTime: true
            }, {
                type: "SET_FACE_TO_ENTITY",
                entity: b,
                rotate: false
            }, {
                type: "SHOW_ANIMATION",
                anim: "pet"
            }, {
                type: "WAIT",
                time: 1.5
            }, {
                type: "SHOW_ANIMATION",
                anim: "preIdle",
                wait: true
            }, {
                type: "WAIT",
                time: 1
            }
            ], false, false);
            b = [{
                type: "SHOW_ANIMATION",
                anim: "idle",
                viaWalkConfig: true
            }, {
                type: "SET_FACE_TO_ENTITY",
                entity: this,
                rotate: true
            }, {
                type: "SET_COLL_TYPE",
                value: "IGNORE"
            }, {
                type: "WAIT",
                time: 1
            }, {
                type: "SET_FACE_TO_ENTITY",
                entity: this,
                rotate: true
            }, {
                type: "WAIT",
                time: 0.6
            }, {
                type: "PLAY_PET_SOUND"
            }, {
                type: "WAIT",
                time: 0.6
            }, {
                type: "SHOW_EFFECT",
                effect: {
                    sheet: "npc",
                    name: "hearts"
                }
            }
            ];
            this.skin.pet.coll.float.height ? b.push({
                type: "SET_Z_VEL",
                value: 100
            }, {
                type: "SET_FLOAT_HEIGHT",
                value: 8
            }, {
                type: "SET_FLOAT_PARAMS",
                variance: 8,
                accel: 10
            }, {
                type: "WAIT",
                time: 1
            }) : b.push({
                type: "JUMP",
                jumpHeight: "S",
                wait: true,
                ignoreSounds: true
            }, {
                type: "JUMP",
                jumpHeight: "S",
                wait: true,
                ignoreSounds: true
            }, {
                type: "JUMP",
                jumpHeight: "S",
                wait: true,
                ignoreSounds: true
            });
            b = new ig.Action("PLAYER_IDLE", b, false, false);
            this.setAction(a);
            this.skin.pet.setAction(b);
        },
        updateAnimSheet: function (a) {
            var b = null,
                c = sc.playerSkins.getCurrentSkin("Appearance");
            if (c && c.loaded)
                if (c.noHide)
                    b = c;
                else if ((!sc.model.isCutscene() ||
                    ig.game.events.hasBlockingEventCallHint("SKIN_ALLOWED")) && !ig.dreamFx.isActive())
                    b = c;
            if (b != this.skin.appearance) {
                if (!a) {
                    if (this.skin.appearanceFx) {
                        this.skin.appearanceFx.setCallback(null);
                        this.skin.appearanceFx.stop();
                        this.skin.appearanceFx = null;
                    }
                    b ? this.skin.appearanceFx = b.fx.spawnOnTarget("skinOn", this, {
                        callback: this
                    }) : this.skin.appearance.fx.spawnOnTarget("skinOff", this);
                }
                this.skin.appearance = b;
            }
            if (this.animSheetReplace)
                this.animSheet = this.animSheetReplace;
            else {
                a = this.model.animSheet;
                if (this.skin.appearance &&
                    !this.skin.appearanceFx)
                    a = this.skin.appearance.animSheet;
                this.animSheet = a;
            }
        },
        updateSkinStepFx: function () {
            var a = sc.playerSkins.getCurrentSkin("StepEffect");
            this.skin.stepFx = a && a.loaded ? a.fx : null;
        },
        updateSkinAura: function () {
            var a = sc.playerSkins.getCurrentSkin("Aura");
            this.skin.auraFx = a && a.loaded ? a.fx : null;
            this.skin.auraFxHandle && this.skin.auraFxHandle.stop();
            this.skin.auraFxHandle = null;
            if (this.skin.auraFx) {
                var a = "aura",
                    b = g[this.model.currentElementMode];
                this.skin.auraFx.hasEffect(a + b) && (a = a + b);
                this.skin.auraFxHandle =
                    this.skin.auraFx.spawnOnTarget(a, this, {
                        duration: -1
                    });
            }
        },
        updateSkinPet: function (a) {
            if (this.skin.pet) {
                this.skin.pet.remove();
                this.skin.pet = null;
            }
            var b = sc.playerSkins.getCurrentSkin("Pet");
            if (b && b.loaded)
                this.skin.pet = ig.game.spawnEntity(sc.PlayerPetEntity, 0, 0, 0, {
                    petSkin: b
                }, a || false);
        },
        onEffectEvent: function (a) {
            if (a == this.skin.appearanceFx && a.state >= ig.EFFECT_STATE.POST_LOOP) {
                this.skin.appearanceFx = null;
                this.updateAnimSheet();
            }
        },
        regenPvp: function (a) {
            this.parent(a);
            this.model.addElementLoad(-1E3);
        },
        updateModelStats: function (a) {
            this.regenFactor =
                this.params.getModifier("HP_REGEN");
            if (sc.newgame.get("combat-regen-half"))
                this.regenFactor = this.regenFactor / 2;
            else if (sc.newgame.get("combat-regen-zero"))
                this.regenFactor = 0;
            this.stunData.stunEscapeTime = 1.5;
            this.gui.crosshair && this.gui.crosshair.setBaseSpeedFactor(1 + this.params.getModifier("AIM_SPEED"));
            if (this.params)
                this.params.criticalDmgFactor = 1.5 + this.params.getModifier("CRITICAL_DMG");
            this.stunThreshold = this.params.getModifier("STUN_THRESHOLD");
            this.updateAnimSheet(a);
            this.configs.aiming.overwrite("maxVel",
                100 * (1 + this.params.getModifier("AIMING_MOVEMENT")));
            this.maxDash = Math.round(this.getMaxDashes() + this.params.getModifier("DASH_STEP"));
            this.spikeDmg.baseFactor = this.params.getModifier("SPIKE_DMG");
        },
        getMaxDashes: function () {
            return this.model.name != "Lea" ? 3 : sc.newgame.get("dash-1") ? 1 : 3;
        },
        hasCameraTarget: function (a) {
            return this.cameraTargets.indexOf(a) != -1;
        },
        addCameraTarget: function (a, b) {
            if (this.cameraTargets.indexOf(a) == -1) {
                this.cameraTargets.push(a);
                this._updateCameraHandle(b || "NORMAL");
            }
        },
        removeCameraTarget: function (a,
            b) {
            this.cameraTargets.erase(a);
            this._updateCameraHandle(b || "NORMAL");
        },
        removeAllCameraTargets: function (a) {
            this.cameraTargets.length = 0;
            this._updateCameraHandle(a || "NORMAL");
        },
        _updateCameraHandle: function (a) {
            var b = null;
            if (this.cameraTargets.length == 0)
                b = new ig.Camera.TargetHandle(new ig.Camera.EntityTarget(this), 0, 0);
            else {
                b = [this];
                b.push.apply(b, this.cameraTargets);
                b = new ig.Camera.TargetHandle(new ig.Camera.MultiEntityTarget(b, true), 0, 0);
            }
            b.keepZoomFocusAligned = true;
            sc.PLAYER_ZOOM != 1 && b.setZoom(sc.PLAYER_ZOOM,
                0.1);
            this.cameraHandle ? ig.camera.replaceTarget(this.cameraHandle, b, a, KEY_SPLINES.EASE_IN_OUT) : ig.camera.pushTarget(b, a, KEY_SPLINES.EASE_IN_OUT);
            this.cameraHandle = b;
        },
        onPlayerPlaced: function () {
            if (ig.camera) {
                for (; ig.camera.getTargetCount() > 0;)
                    ig.camera.popTarget();
                this._updateCameraHandle();
            }
            sc.party.onMapEnter();
            Vec3.assign(this.respawn.pos, this.coll.pos);
            Vec3.assign(this.mapStartPos, this.coll.pos);
            this.skin.pet && this.skin.pet.resetStartPos();
        },
        onMoveEffect: function (a) {
            a == "step" && sc.stats.addMap("player",
                "steps", 1);
            this.skin.stepFx && this.skin.stepFx.hasEffect(a) && (a == "jump" ? this.skin.stepFx.spawnOnTarget("jump", this, {
                angle: Vec2.clockangle(this.face)
            }) : this.skin.stepFx.spawnOnTarget(a, this));
            sc.gameCode.isEnabled("speedlines") && (a == "step" ? ig.game.effects.speedlines.spawnOnTarget("speedlinesWalk", this, {
                duration: 0.2,
                align: "CENTER"
            }) : a == "dash" ? ig.game.effects.speedlines.spawnOnTarget("speedlinesDash", this, {
                duration: 0.3,
                align: "CENTER"
            }) : a == "jump" && ig.game.effects.speedlines.spawnOnTarget("speedlinesJump",
                this, {
                duration: 0.5,
                align: "CENTER"
            }));
        },
        setAction: function (a, b, c) {
            this.coll.relativeVel = 1;
            this.parent(a, b, c);
        },
        doCombatAction: function (a) {
            this.doPlayerAction(a);
            this.model.increaseActionHeat(sc.PLAYER_ACTION[a]);
            this.actionBlocked.action = this.actionBlocked.charge = this.actionBlocked.move = this.actionBlocked.reaim = this.actionBlocked.dash = 100;
            sc.gameCode.isEnabled("speedlines") && ig.game.effects.speedlines.spawnOnTarget("speedlinesDash", this, {
                duration: 0.3,
                align: "CENTER"
            });
        },
        setActionBlocked: function (a) {
            this.actionBlocked.action =
                a.action;
            this.actionBlocked.charge = a.charge || a.action;
            this.actionBlocked.dash = a.dash;
            this.actionBlocked.reaim = a.reaim;
            this.actionBlocked.move = a.move;
        },
        clearActionBlocked: function () {
            this.charging.executeLevel = 0;
            this.actionBlocked.action = this.actionBlocked.move = this.actionBlocked.charge = this.actionBlocked.reaim = this.actionBlocked.dash = 0;
        },
        showChargeEffect: function (a) {
            this.charging.fx.charge(this.model.currentElementMode, a);
            this.params.notifySpConsume(sc.PLAYER_SP_COST[a - 1]);
            this.cameraHandle.setZoom(sc.PLAYER_ZOOM +
                a * 0.5 / 3, 0.5, KEY_SPLINES.JUMPY);
            if (a >= 2) {
                a = new ig.ZoomBlurHandle(a == 2 ? "LIGHT" : "MEDIUM", 0.2, 0, 0.3);
                ig.screenBlur.addZoom(a);
            }
        },
        clearCharge: function () {
            if (this.charging.time != -1) {
                this.params.notifySpConsume(0);
                this.charging.time = -1;
                ig.slowMotion.clearNamed("playerCharge", 0);
                this.gui.crosshair.setSpecial(false);
                this.coll.time.animStatic = false;
                this.charging.fx.stop();
                this.cameraHandle.setZoom(sc.PLAYER_ZOOM, 0.5, KEY_SPLINES.EAST_IN_OUT);
            }
        },
        onKill: function (a) {
            this.clearCharge();
            this.parent(a);
            sc.Model.removeObserver(this.model,
                this);
            sc.Model.removeObserver(sc.model, this);
            sc.Model.removeObserver(this.params, this);
            sc.Model.removeObserver(sc.playerSkins, this);
            sc.combat.removeActiveCombatant(this);
            if (!a) {
                a = ig.vars.get("stats.deaths") || 0;
                ig.game.respawn();
                ig.vars.set("stats.deaths", a + 1);
            }
        },
        show: function () {
            this.parent();
            this.gui.crosshair = ig.game.spawnEntity(ig.ENTITY.Crosshair, 0, 0, 0, {
                thrower: this,
                controller: new sc.PlayerCrossHairController
            });
            this.updateModelStats();
            this.updateSkinAura();
        },
        hide: function () {
            this.parent();
            if (this.skin.auraFxHandle) {
                this.skin.auraFxHandle.stop();
                this.skin.auraFxHandle = null;
            }
        },
        getChargeType: function (a, b) {
            return this.dashTimer > 0.33 ? f : a.guarding || sc.control.guarding() && Vec2.isZero(b.moveDir) ? this.model.getCore(sc.PLAYER_CORE.GUARD) ? e : d : sc.control.dashHold() ? f : this.state == 1 || (this.state == 2 || this.state == 5) && this.model.getCore(sc.PLAYER_CORE.THROWING) && sc.control.aiming() ? c : d;
        },
        getCurrentChargeLevel: function () {
            return this.charging.time <= 0 ? 0 : cachedRingMenuPos(this.charging);
        },
        getMaxChargeLevel: function (a) {
            var b = 0,
                a = a.actionKey,
                c = 3;
            for (this.model.name == "Lea" && (sc.newgame.get("combat-arts-level-1") ?
                c = 1 : sc.newgame.get("combat-arts-level-2") && (c = 2)); b < c && this.model.getAction(sc.PLAYER_ACTION[a + (b + 1)]);)
                b++;
            return b;
        },
        startCharge: function (a) {
            if (!this.model.getCore(sc.PLAYER_CORE.SPECIAL) || !this.model.getCore(sc.PLAYER_CORE.CLOSE_COMBAT) && a == d)
                return false;
            var b = this.getMaxChargeLevel(a),
                e = this.model.params.getSp(),
                f = 0;
            e >= sc.PLAYER_SP_COST[2] ? f = 3 : e >= sc.PLAYER_SP_COST[1] ? f = 2 : e >= sc.PLAYER_SP_COST[0] && (f = 1);
            b = Math.min(b, f);
            if (f == 0) {
                if (!this.charging.msg || this.charging.msg.isFinished()) {
                    f = ig.lang.get("sc.gui.combat.no-sp");
                    this.charging.msg = new sc.SmallEntityBox(this, f, 0.5);
                    ig.gui.addGuiElement(this.charging.msg);
                }
            } else {
                this.charging.msg && !this.charging.msg.isFinished() && this.charging.msg.remove();
                this.charging.msg = null;
            }
            if (b == 0)
                return false;
            this.charging.maxLevel = b;
            this.charging.type = a;
            Vec2.assignC(this.charging.prefDir, 0, 0);
            a == c ? this.quickStateSwitch(1) : a == d && this.quickStateSwitch(3);
            return true;
        },
        getChargeAction: function (a, b) {
            for (var c = a.actionKey; b && !this.model.getAction(sc.PLAYER_ACTION[c + b]);)
                b--;
            if (!b)
                return 0;
            var d = sc.PLAYER_SP_COST[b - 1];
            sc.newgame.get("infinite-sp") || this.model.params.consumeSp(d);
            return c + b;
        },
        quickStateSwitch: function (a) {
            this.state = a;
            if (a == 1) {
                this.gui.crosshair.setActive(true);
                this.setDefaultConfig(this.configs.aiming);
            } else {
                this.gui.crosshair.setActive(false);
                this.setDefaultConfig(this.configs.normal);
            }
        },
        isElementChangeBlocked: function () {
            return this.isControlBlocked() || this.charging.time != -1;
        },
        isControlBlocked: function () {
            return this.hasStun() || this.params.isDefeated() || this.interactObject ||
                this.currentAction && this.currentAction.eventAction;
        },
        update: function () {
            this.playerTrack.lastPlayerAction = null;
            for (var b = this.cameraTargets.length; b--;) {
                var c = this.cameraTargets[b];
                c._killed && this.removeCameraTarget(c);
            }
            if (this.attackResetTimer > 0) {
                this.attackResetTimer = this.attackResetTimer - ig.system.tick;
                if (this.attackResetTimer <= 0)
                    this.attackCounter = this.attackResetTimer = 0;
            }
            if (this.perfectGuardCooldown > 0) {
                this.perfectGuardCooldown = this.perfectGuardCooldown - ig.system.tick;
                if (this.perfectGuardCooldown <
                    0)
                    this.perfectGuardCooldown = 0;
            }
            if (!sc.inputForcer.isBlocking()) {
                a(this.actionBlocked, "charge");
                a(this.actionBlocked, "action");
                a(this.actionBlocked, "dash");
                a(this.actionBlocked, "reaim");
                a(this.actionBlocked, "move");
                this.model.updateLoop(sc.combat.isInCombat(this));
                if (this.explicitAimStart) {
                    this.explicitAimStart = this.explicitAimStart - ig.system.actualTick;
                    if (this.explicitAimStart <= 0)
                        this.explicitAimStart = 0;
                }
                if (this.hasStun() && this.interactObject) {
                    this.interactObject.onInteractObjectDrop();
                    this.explicitAimStart =
                        0.05;
                    this.interactObject = null;
                }
                b = this.gatherInput();
                if (this.doEscapeTimer > 0) {
                    this.doEscapeTimer = this.doEscapeTimer - ig.system.tick;
                    if (this.doEscapeTimer <= 0 || this.params.isDefeated()) {
                        this.doEscapeTimer = 0;
                        Vec2.assignC(this.dashDir, 0, 0);
                        this.hitStable = sc.ATTACK_TYPE.LIGHT;
                    } else if (this.damageTimer > 0 && this.damageTimer <= 0.2)
                        this.damageTimer = 1E-5;
                }
                if (this.switchedMode) {
                    this.switchedMode = false;
                    sc.combat.showModeChange(this, this.model.currentElementMode);
                    this.updateSkinAura();
                }
                if (this.isControlBlocked()) {
                    this.clearCharge();
                    this.clearActionBlocked();
                    this.regenShield(false);
                    sc.combat.clearModeAura(this);
                    this.dashBlock = this.dashTimer = this.dashCount = 0;
                    this.hasStun() && this.stunData.time >= this.stunData.stunEscapeTime ? this.handleDash(j, b, true, true) : this.hasStun() && this.damageTimer <= 0.2 ? this.handleDash(j, b, true) : this.dashDir.x = this.dashDir.y = 0;
                    this.attackResetTimer = this.attackCounter = 0;
                    b = this.currentAction && this.currentAction.eventAction ? 0 : 4;
                    if (this.state != b) {
                        this.state = b;
                        this.jumpingEnabled = false;
                        if (this.state == 0) {
                            this.setDefaultConfig(this.configs.normal);
                            this.defaultConfig.apply(this);
                        }
                        this.gui.crosshair.setActive(false);
                        Vec2.assignC(this.throwDir, 0, 0);
                        this.doAttack = false;
                    }
                    this.parent();
                } else {
                    if (this.model.hasLevelUp() && this.coll.pos.z == this.coll.baseZPos && sc.model.isOutOfCombatDialogReady()) {
                        c = (c = (c = this.coll._collData && this.coll._collData.groundEntry) && c.parentColl || c) && c.entity;
                        (!c || !c.isDefeated || !c.isDefeated()) && this.levelUpNotifier.runLevelUpScene(this, this.model);
                    }
                    if (this.currentAction && this.currentAction.name === "PLAYER_IDLE" && !Vec2.isZero(b.moveDir)) {
                        this.cancelAction();
                        this.skin.pet && (this.skin.pet.currentAction && this.skin.pet.currentAction.name === "PLAYER_IDLE") && this.skin.pet.cancelAction();
                    }
                    this.currentAction || this.clearActionBlocked();
                    if (!this.jumping && this.coll.pos.z == this.coll.baseZPos)
                        this.maxJumpHeight = -1;
                    this.handleDash(j, b);
                    this.handleGuard(j, b);
                    this.handleCharge(j, b);
                    this.handleStateChange(j, b);
                    if (this.dashTimer > 0) {
                        ig.game.firstUpdateLoop && sc.stats.addMap("player", "dashTime", ig.system.rawTick);
                        this.dashTimer = this.dashTimer - ig.system.tick;
                        if (this.dashTimer <=
                            0) {
                            this.dashTimer = 0;
                            this.gui.crosshair.setSpeedFactor(1);
                            !j.guarding && !j.isCharging && this.defaultConfig.apply(this);
                        }
                    } else {
                        this.dashCount = 0;
                        this.updatePlayerMovement(j, b);
                    }
                    if (this.state != 5 || j.startState == 5)
                        this.gui.crosshair.active && (this.state != 2 || j.guarding) && !j.isCharging ? this.gui.crosshair.getDir(this.face) : ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE && j.guarding && this.gui.crosshair.getDir(this.face);
                    this.handleStateStart(j, b);
                    this.charging.executing = false;
                    !sc.model.isCutscene() &&
                        (this.state != 0 || !Vec2.isZero(this.coll.accelDir) || j.guarding) ? sc.combat.showModeAura(this, this.model.currentElementMode) : sc.combat.clearModeAura(this);
                    this.parent();
                    if (this.idle.timer > 0 && this.currentAnim == "idle" && !this.isControlBlocked() && !sc.model.isCutscene() && !this.currentAction) {
                        this.idle.timer = this.idle.timer - ig.system.tick;
                        if (this.idle.timer <= 3.75 && this.skin.pet && ig.CollTools.getGroundDistance(this.skin.pet.coll, this.coll) < 32 && Vec2.dot(this.skin.pet.face, this.face) <= 0 && this.skin.pet.coll.baseZPos ==
                            this.coll.pos.z) {
                            this.idle.timer = 0;
                            this.doPetAction();
                        } else if (this.idle.timer <= 0) {
                            b = this.idle.actions[Math.floor(this.idle.actions.length * Math.random())];
                            this.setAction(b);
                        }
                    } else
                        this.idle.timer = 5 + Math.random() * 5;
                }
            }
        },
        gatherInput: function () {
            i.thrown = false;
            i.melee = false;
            i.aimStart = false;
            i.aim = false;
            i.attack = false;
            i.autoThrow = false;
            i.charge = false;
            i.dashX = 0;
            i.dashY = 0;
            i.guard = false;
            i.relativeVel = this.coll.relativeVel;
            Vec2.assign(i.moveDir, 0, 0);
            if (ig.game.isControlBlocked()) {
                this.explicitAimStart = 0.05;
                return i;
            }
            i.charge =
                sc.control.charge();
            if (!ig.interact.isBlocked()) {
                if (this.model.getCore(sc.PLAYER_CORE.THROWING)) {
                    i.aimStart = sc.control.aimStart();
                    i.aim = sc.control.aiming();
                    i.thrown = sc.control.thrown();
                    i.autoThrow = sc.control.autoThrown();
                }
                if (!this.floating && this.model.getCore(sc.PLAYER_CORE.CLOSE_COMBAT)) {
                    i.attack = this.model.getCore(sc.PLAYER_CORE.THROWING) ? sc.control.attacking() : sc.control.fullScreenAttacking();
                    i.melee = sc.control.melee();
                }
            }
            if (this.model.getCore(sc.PLAYER_CORE.GUARD))
                i.guard = sc.control.guarding();
            i.relativeVel =
                !this.floating && this.model.getCore(sc.PLAYER_CORE.MOVE) ? sc.control.moveDir(i.moveDir, this.coll.relativeVel) : 1;
            if (Vec2.isZero(i.moveDir))
                this.moveDirStartedTimer = 0;
            else {
                var a = Vec2.angle(i.moveDir, this.lastMoveDir);
                if (!Vec2.isZero(this.lastMoveDir) && Math.abs(a) > Math.PI / 3)
                    this.moveDirStartedTimer = 0;
                this.moveDirStartedTimer = this.moveDirStartedTimer + ig.system.actualTick;
            }
            a = false;
            if (this.charging.time >= 0 || sc.inputForcer.isSubmitted())
                a = true;
            i.aim && (a = true);
            ig.input.currentDevice == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE &&
                (a = true);
            if (this.keepLastMoveDir <= 0 && !Vec2.equal(this.lastMoveDir, i.moveDir))
                this.keepLastMoveDir = 2 / 60;
            if (this.keepLastMoveDir > 0) {
                this.keepLastMoveDir = this.keepLastMoveDir - ig.system.actualTick;
                if (!sc.inputForcer.isSubmitted() && this.keepLastMoveDir > 0 && (i.moveDir.x != 0 || i.moveDir.y != 0)) {
                    if (i.moveDir.x == 0)
                        i.moveDir.x = this.lastMoveDir.x;
                    if (i.moveDir.y == 0)
                        i.moveDir.y = this.lastMoveDir.y;
                }
            }
            Vec2.assign(this.lastMoveDir, i.moveDir);
            if (!this.jumping && sc.control.dashing() && this.dashBlock < 0.2 && (a || this.moveDirStartedTimer >
                0.05)) {
                i.dashX = i.moveDir.x;
                i.dashY = i.moveDir.y;
            }
            return i;
        },
        handleDash: function (a, b, c, d) {
            if (this.dashBlock > 0)
                this.dashBlock = this.dashBlock - ig.system.tick;
            if (!this.actionBlocked.dash && (b.dashX || b.dashY) && this.dashTimer <= 0.4 && this.dashBlock <= 0) {
                if (b.dashX)
                    this.dashDir.x = b.dashX;
                if (b.dashY)
                    this.dashDir.y = b.dashY;
                if (d) {
                    this.doEscapeTimer = 0.3;
                    this.hitStable = sc.ATTACK_TYPE.MASSIVE;
                }
            }
            a.redashReady = this.dashTimer <= (this.dashCount < this.maxDash ? 0.15 : 0.1);
            if (c)
                a.redashReady = false;
            if (!this.jumping && this.model.getCore(sc.PLAYER_CORE.DASH)) {
                if ((this.dashDir.x !=
                    0 || this.dashDir.y != 0) && a.redashReady) {
                    if (this.doEscapeTimer) {
                        this.doEscapeTimer = 0;
                        this.stunEscapeDash = true;
                        this.resetStunData();
                        this.hitStable = sc.ATTACK_TYPE.LIGHT;
                        sc.combat.showCombatMessage(this, sc.COMBAT_MSG_TYPE.STUN_CANCEL);
                    } else
                        this.stunEscapeDash = false;
                    this.startDash();
                    a.redashReady = false;
                }
            } else {
                this.dashCount = 0;
                this.dashTimer = this.dashDir.x = this.dashDir.y = 0;
            }
        },
        handleGuard: function (a, b) {
            var c = this.guard.damage < 1 && a.redashReady && !this.actionBlocked.action && (this.charging.time == -1 || this.charging.type ==
                e);
            a.guarding = false;
            var d = this.model.getAction(sc.PLAYER_ACTION.GUARD),
                f = this.model.getAction(sc.PLAYER_ACTION.PERFECT_GUARD);
            if (c)
                if (b.guard) {
                    if (this.attackCounter && !this.attackResetTimer)
                        this.attackResetTimer = 0.1;
                    if (this.currentAction != d && this.currentAction != f) {
                        this.dashTimer = 0;
                        if (this.perfectGuardCooldown > 0)
                            this.setAction(d);
                        else {
                            this.setAction(f);
                            this.perfectGuardCooldown = 0.5;
                        }
                    }
                    this.gui.crosshair.setSpeedFactor(0.25);
                    a.guarding = true;
                    ig.game.firstUpdateLoop && sc.stats.addMap("combat", "guardTime",
                        ig.system.rawTick);
                    this.recordInput && ig.vars.add("playerVar.input.guardTime", ig.system.tick);
                } else if (this.charging.time != -1 && this.charging.type == e)
                    a.guarding = true;
                else if (this.currentAction == d || this.currentAction == f) {
                    this.cancelAction();
                    this.gui.crosshair.setSpeedFactor(1);
                }
            this.regenShield(a.guarding);
        },
        handleCharge: function (a, c) {
            if (this.charging.block > 0) {
                this.charging.block = this.charging.block - ig.system.actualTick;
                if (this.charging.block < 0)
                    this.charging.block = 0;
            } else if (c.charge && this.charging.time ==
                -1 && this.actionBlocked.charge != -1 && this.actionBlocked.charge < 0.2) {
                var d = this.getChargeType(a, c);
                if (this.startCharge(d)) {
                    this.attackResetTimer = this.attackCounter = 0;
                    this.dashAttackCount = Math.min(this.maxDash, this.dashCount);
                    this.dashTimer = 0;
                    this.dashDir.x = this.dashDir.y = 0;
                    this.charging.swapped = false;
                    this.charging.time = 0;
                    this.charging.cancelTime = 0;
                }
            }
            a.applyCharge = 0;
            a.isCharging = false;
            if (this.charging.time >= 0) {
                a.isCharging = true;
                if (!this.actionBlocked.charge) {
                    if (this.charging.time == 0) {
                        this.showChargeEffect(1);
                        this.gui.crosshair.setSpecial(true);
                        if (!a.guarding) {
                            this.currentAction && this.cancelAction();
                            this.doPlayerAction("CHARGING");
                        }
                        this.coll.time.animStatic = true;
                        this.gui.crosshair.active ? this.gui.crosshair.getDir(this.face) : Vec2.isZero(c.moveDir) || Vec2.assign(this.face, c.moveDir);
                    }
                    Vec2.isZero(c.moveDir) || Vec2.assign(this.charging.prefDir, c.moveDir);
                    d = cachedRingMenuPos(this.charging);
                    ig.game.firstUpdateLoop && sc.stats.addMap("combat", "charging", ig.system.rawTick);
                    if (!sc.autoControl.isActive() ||
                        !ig.slowMotion.hasSlowMotion("tutorialMsg"))
                        this.charging.time = this.charging.time + ig.system.actualTick;
                    if (!sc.autoControl.isActive())
                        this.charging.cancelTime = this.charging.cancelTime + ig.system.actualTick;
                    if (this.charging.maxLevel < 3)
                        this.charging.time = Math.min(this.charging.time, h[this.charging.maxLevel] - 0.05);
                    var e = cachedRingMenuPos(this.charging);
                    if (d >= 1 && e != d) {
                        this.charging.cancelTime = 0;
                        this.showChargeEffect(e);
                    }
                }
                if ((this.charging.cancelTime > 1 || !c.charge) && this.charging.time >= h[0]) {
                    a.applyCharge = cachedRingMenuPos(this.charging);
                    a.isCharging = false;
                    this.clearCharge();
                    if (this.charging.cancelTime > 1)
                        this.charging.block = 0.5;
                }
            }
        },
        handleStateChange: function (a, b) {
            a.startState = -1;
            if (a.isCharging) {
                if (!this.charging.swapped)
                    if (this.charging.type != e && a.guarding) {
                        this.charging.swapped = true;
                        this.startCharge(e);
                    } else if (this.charging.type != f && !a.guarding && this.charging.time < 0.1 && sc.control.dashing() && !Vec2.isZero(b.moveDir)) {
                        this.charging.swapped = true;
                        this.startCharge(f);
                    } else if (this.charging.type == d && this.model.getCore(sc.PLAYER_CORE.THROWING) &&
                        sc.control.chargeThrowSwap()) {
                        this.charging.swapped = true;
                        this.startCharge(c);
                    } else if (this.charging.type == c && sc.control.chargeAttackSwap()) {
                        this.charging.swapped = true;
                        this.startCharge(d);
                    }
            } else {
                if (this.state == 4) {
                    this.state = 0;
                    a.startState = this.state;
                }
                if (a.applyCharge) {
                    this.state = 5;
                    if (this.charging.type == c) {
                        this.gui.crosshair.getThrowDir(this.throwDir);
                        this.gui.crosshair.setThrown();
                    }
                    a.startState = this.state;
                } else if (this.state == 0 && (b.attack || b.melee)) {
                    this.state = 3;
                    a.startState = this.state;
                } else if (this.state ==
                    0 && (b.aimStart || !this.explicitAimStart && !this.dashTimer && b.aim)) {
                    this.state = 1;
                    a.startState = this.state;
                } else if (this.state == 1)
                    if (b.thrown || b.autoThrow && (!this.dashTimer || a.redashReady)) {
                        this.gui.crosshair.getThrowDir(this.throwDir);
                        this.state = 2;
                        a.startState = this.state;
                        this.throwCharge = this.gui.crosshair.isThrowCharged();
                        this.gui.crosshair.setThrown();
                        this.gui.crosshair.setSpeedFactor(0.25);
                    } else {
                        if (!b.aim) {
                            this.state = 0;
                            a.startState = this.state;
                        }
                    }
                else if (this.state == 2 || this.state == 3 || this.state == 5) {
                    var g =
                        b.thrown && this.actionBlocked.action >= 0 && this.actionBlocked.action < 0.2 || b.autoThrow && !this.actionBlocked.action;
                    if (this.gui.crosshair.active && !this.doAttack && g) {
                        this.gui.crosshair.getThrowDir(this.throwDir);
                        this.throwCharge = this.gui.crosshair.isThrowCharged();
                        this.gui.crosshair.setThrown();
                    }
                    if ((b.attack || b.melee) && this.actionBlocked.action >= 0 && this.actionBlocked.action < 0.2)
                        this.doAttack = true;
                    if (!this.actionBlocked.action && !Vec2.isZero(this.throwDir)) {
                        this.state = 2;
                        a.startState = this.state;
                    } else if (!this.actionBlocked.action &&
                        this.doAttack) {
                        this.state = 3;
                        a.startState = this.state;
                    } else if (!this.currentAction || a.guarding || !this.actionBlocked.move && (b.moveDir.x != 0 || b.moveDir.y != 0) || !this.actionBlocked.reaim && b.aim) {
                        if (this.attackCounter && !this.attackResetTimer)
                            this.attackResetTimer = 0.1;
                        if (this.dashTimer <= 0 && !a.guarding) {
                            this.cancelAction();
                            this.clearActionBlocked();
                        }
                        if (b.aim) {
                            this.state = 1;
                            a.startState = this.state;
                        } else {
                            this.state = 0;
                            a.startState = this.state;
                            this.setCurrentAnim("preIdle", true, "idle");
                        }
                    }
                }
            }
        },
        updatePlayerMovement: function (a,
            b) {
            if (a.guarding) {
                this.state == 1 && ig.game.firstUpdateLoop && sc.stats.addMap("combat", "aiming", ig.system.rawTick);
                Vec2.assignC(this.coll.accelDir, 0, 0);
                (b.moveDir.x || b.moveDir.y) && Vec2.assign(this.face, b.moveDir);
            } else if (this.state == 0 || this.state == 1) {
                this.state == 1 && ig.game.firstUpdateLoop && sc.stats.addMap("combat", "aiming", ig.system.rawTick);
                if (!this.currentAction || this.currentAction.parallelMove) {
                    Vec2.assign(this.coll.accelDir, b.moveDir);
                    this.coll.relativeVel = b.relativeVel;
                }
                this.jumping && (Vec2.dot(this.coll.accelDir,
                    this.jumpForwardDir) >= 0 && Vec2.distance(this.coll.pos, this.jumpPoint) < 8 ? Vec2.add(this.coll.accelDir, this.jumpForwardDir) : Vec2.assignC(this.jumpForwardDir, 0, 0));
            } else
                this.jumping || Vec2.assignC(this.coll.accelDir, 0, 0);
        },
        handleStateStart: function (a, b) {
            a.startState != -1 && this.cancelJump();
            switch (a.startState) {
                case 0:
                    this.recordInput && ig.vars.set("playerVar.input.aiming", false);
                    this.setWalkAnims("normal");
                    this.setDefaultConfig(this.configs.normal);
                    this.gui.crosshair.setActive(false);
                    break;
                case 1:
                    this.recordInput &&
                        ig.vars.set("playerVar.input.aiming", true);
                    this.explicitAimStart = 0;
                    this.setDefaultConfig(this.configs.aiming);
                    this.dashTimer <= 0 && (!this.jumping && !a.guarding) && this.setAction(this.model.getAction(sc.PLAYER_ACTION.AIM_START));
                    this.setWalkAnims("aiming");
                    this.gui.crosshair.chargeActive = this.model.getCore(sc.PLAYER_CORE.CHARGE);
                    this.gui.crosshair.active || this.gui.crosshair.setActive(true);
                    this.gui.crosshair.setSpeedFactor(1);
                    break;
                case 3:
                    this.recordInput && ig.vars.set("playerVar.input.aiming", false);
                    ig.input.currentDevice ==
                        ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE && (this.model.getCore(sc.PLAYER_CORE.THROWING) && sc.options.get("close-circle")) && this.gui.crosshair.setCircleGlow();
                    this.attackCounter++;
                    this.attackResetTimer = 0;
                    var g;
                    if (this.attackCounter <= 3)
                        g = this.attackCounter % 2 == 1 ? "ATTACK_REV" : "ATTACK";
                    else {
                        g = "ATTACK_FINISHER";
                        this.attackResetTimer = this.attackCounter = 0;
                    }
                    ig.vars.add("playerVar.input.melee", 1);
                    sc.stats.addMap("player", "close", 1);
                    this.dashAttackCount = Math.min(this.maxDash, this.dashCount);
                    this.charging.executeLevel =
                        0;
                    this.startCloseCombatAction(g, b);
                    break;
                case 2:
                    if (this.recordInput) {
                        ig.vars.set("playerVar.input.aiming", false);
                        ig.vars.add("playerVar.input.thrown", 1);
                    }
                    this.throwCounter++;
                    g = this.throwCounter % 2 == 0 ? this.throwCharge ? "THROW_CHARGED_REV" : "THROW_NORMAL_REV" : this.throwCharge ? "THROW_CHARGED" : "THROW_NORMAL";
                    this.dashAttackCount = Math.min(this.maxDash, this.dashCount);
                    this.charging.executeLevel = 0;
                    this.startThrowAction(g, b);
                    break;
                case 5:
                    g = this.getChargeAction(this.charging.type, a.applyCharge);
                    if (sc.options.get("combat-art-name")) {
                        var h =
                            this.model.getCombatArtName(sc.PLAYER_ACTION[g]);
                        if (h) {
                            h = new sc.SmallEntityBox(this, h.toString(), 1);
                            h.stopRumble();
                            ig.gui.addGuiElement(h);
                        }
                    }
                    this.charging.executeLevel = a.applyCharge;
                    sc.stats.addMap("combat", "specials", 1);
                    sc.stats.addMap("combat", "specials-" + this.model.currentElementMode + "-level-" + a.applyCharge, 1);
                    if (this.charging.type == d) {
                        sc.stats.addMap("combat", "specialsClose", 1);
                        Vec2.isZero(this.charging.prefDir) || Vec2.assign(this.face, this.charging.prefDir);
                        this.startCloseCombatAction(g, b);
                    } else if (this.charging.type ==
                        c) {
                        sc.stats.addMap("combat", "specialsThrow", 1);
                        this.startThrowAction(g, b);
                    } else if (this.charging.type == e) {
                        sc.stats.addMap("combat", "specialsGuard", 1);
                        this.doCombatAction(g);
                    } else if (this.charging.type == f) {
                        sc.stats.addMap("combat", "specialsDash", 1);
                        Vec2.isZero(this.charging.prefDir) || Vec2.assign(this.dashDirData, this.charging.prefDir);
                        this.gui.crosshair.setActive(false);
                        this.setAttribute("dashDir", this.dashDirData);
                        this.doCombatAction(g);
                    }
            }
        },
        startThrowAction: function (a, b) {
            if (this.dashTimer > 0)
                this.dashBlock =
                    0.3;
            this.dashTimer = 0;
            Vec2.assign(this.face, this.throwDir);
            this.coll.pos.z == this.coll.baseZPos ? this.setAttribute("dashDir", Vec2.assign(this.dashDirData, b.moveDir)) : this.setAttribute("dashDir", Vec2.assignC(this.dashDirData, 0, 0));
            Vec2.assign(this.throwDirData, this.throwDir);
            Vec2.assignC(this.throwDir, 0, 0);
            this.doCombatAction(a);
        },
        startCloseCombatAction: function (a, b) {
            if (this.dashTimer > 0)
                this.dashBlock = 0.3;
            this.dashTimer = 0;
            this.doAttack = false;
            this.gui.crosshair.setActive(false);
            this.coll.pos.z == this.coll.baseZPos ?
                this.setAttribute("dashDir", Vec2.assign(this.dashDirData, b.moveDir)) : this.setAttribute("dashDir", Vec2.assignC(this.dashDirData, 0, 0));
            Vec2.isZero(b.moveDir) || Vec2.assign(this.face, b.moveDir);
            this.doCombatAction(a);
        },
        startDash: function () {
            if (this.state == 3) {
                this.recordInput && ig.vars.add("playerVar.input.attackDashCancel", 1);
                sc.stats.addMap("player", "atkDashCancel", 1);
            }
            this.attackCounter = 0;
            this.dashCount++;
            this.doAttack = this.dashPerfect = false;
            Vec2.assignC(this.throwDir, 0, 0);
            this.gui.crosshair.active || Vec2.assign(this.face,
                this.dashDir);
            this.setAttribute("dashDir", Vec2.assign(this.dashDirData, this.dashDir));
            this.dashDir.x = this.dashDir.y = 0;
            if (this.charging.time >= 0) {
                if (this.charging.time <= 0.2)
                    return;
                this.clearCharge();
                this.charging.block = 0.5;
            }
            if (this.state == 2)
                this.state = 1;
            else if (this.state == 3) {
                this.setWalkAnims("normal");
                this.setDefaultConfig(this.configs.normal);
                this.state = 0;
            }
            if (this.dashCount <= this.maxDash) {
                sc.stats.addMap("player", "dash", 1);
                sc.stats.addMap("player", "steps", 3);
            }
            this.clearActionBlocked();
            this.gui.crosshair.reducePrecision(0.2);
            this.gui.crosshair.setSpeedFactor(0.5);
            this.jumpingEnabled = false;
            this.dashTimer = sc.newgame.get("dash-1") ? 0.26 : 0.36;
            this.onMoveEffect("dash");
            var a = this.dashCount <= this.maxDash ? this.getMaxDashes() != 3 ? "DASH_LONG" : "DASH" : "DASH_SLOW";
            this.playerTrack.lastPlayerAction = a;
            this.doPlayerAction(a);
            this.dashCount <= this.maxDash && sc.combat.showModeDash(this, this.model.currentElementMode);
        },
        deferredUpdate: function () {
            if (this.interactObject && this.interactObject.onInteractObjectDeferredUpdate)
                this.interactObject.onInteractObjectDeferredUpdate(this);
        },
        postActionUpdate: function () {
            if (this.interactObject && this.interactObject.onInteractObjectPostActionUpdate)
                this.interactObject.onInteractObjectPostActionUpdate();
        },
        cancelInteract: function () {
            if (this.interactObject) {
                this.interactObject = null;
                if (sc.control.aiming())
                    this.explicitAimStart = 0.05;
            }
        },
        onPreDamageModification: function (a, b, c, d, e, f) {
            this.recordInput && (f ? ig.vars.add("playerVar.input.shieldedHits", 1) : ig.vars.add("playerVar.input.hits", 1));
            if (f) {
                sc.stats.addMap("combat", "shieldedHits", 1);
                if (f == sc.SHIELD_RESULT.PERFECT) {
                    ig.vars.add("playerVar.input.perfectShield",
                        1);
                    sc.stats.addMap("combat", "perfectShield", 1);
                    if (this.params.getModifier("PERFECT_GUARD_RESET") >= 1) {
                        this.perfectGuardCooldown = 0;
                        for (b = this.shieldsConnections.length; b--;)
                            this.shieldsConnections[b].resetPerfectGuardTime();
                    }
                }
            } else
                sc.stats.addMap("combat", "damageHits", 1);
            if (e && f != sc.SHIELD_RESULT.PERFECT && !ig.vars.get("g.newgame.ignoreLeaMustDie"))
                if (sc.newgame.get("lea-must-die"))
                    e.damage = Math.max(e.damage, this.params.currentHp || 1);
                else if (sc.newgame.get("enemy-damage-15"))
                    e.damage = Math.round(e.damage *
                        1.5);
                else if (sc.newgame.get("enemy-damage-2"))
                    e.damage = e.damage * 2;
                else if (sc.newgame.get("enemy-damage-4"))
                    e.damage = e.damage * 4;
            sc.arena.onPreDamageModification(e, f, a);
            return false;
        },
        onPlayerShieldBreak: function () {
            sc.stats.addMap("combat", "shieldBreaks", 1);
            this.state = 4;
            this.cancelAction();
        },
        onPerfectDash: function () {
            if (!this.dashPerfect) {
                sc.stats.addMap("player", "perfectDash", 1);
                sc.arena.onPerfectDodge();
                if (this.model.name == "Lea" && sc.newgame.get("witch-time") && !ig.vars.get("tmp.slowMotionActive")) {
                    sc.combat.showPerfectDashEffect(this);
                    var a = sc.ProxyTools.getProxy("evadeSloMo", this);
                    a && a.spawn(this.coll.pos.x, this.coll.pos.y, this.coll.pos.z, this, this.face, true);
                    this.invincibleTimer = 4;
                }
                this.dashPerfect = true;
            }
        },
        onDamageTaken: function (a, b) {
            b != sc.SHIELD_RESULT.PERFECT && !sc.model.isCutscene() && sc.stats.addMap("combat", "damageTaken", a);
        },
        onHeal: function (a, b) {
            sc.stats.addMap("combat", "healed", b);
        },
        onTargetHit: function (a, b, c, d) {
            if (!ig.vars.get("playerVar.damageStatsIgnore")) {
                sc.stats.addMap("combat", "damageGiven", c.damage);
                sc.stats.setMapMax("combat",
                    "maxDamage", c.damage);
            }
            this.combatStats.lastTarget = a;
            if (c.critical) {
                sc.stats.addMap("combat", "critHits", 1);
                b.ballDamage ? sc.stats.addMap("combat", "critHitsThrow", 1) : sc.stats.addMap("combat", "critHitsClose", 1);
            }
            if (b.spFactor) {
                b.ballDamage || sc.stats.addMap("player", "closeHits", 1);
                this.model.onTargetHit(a, b, c);
            }
            sc.arena.onTargetHit(b, c, d, a);
            this.parent(a, b, c, d);
        },
        onJump: function (a, b) {
            sc.stats.addMap("player", "jumps", 1);
            this.maxJumpHeight = this.coll.pos.z + a;
            Vec2.assign(this.jumpPoint, this.coll.pos);
            a >= 16 ? Vec2.assign(this.jumpForwardDir,
                this.coll.accelDir) : Vec2.assignC(this.jumpForwardDir, 0, 0);
            this.parent(a, b);
        },
        onPhysicsSquish: function (a) {
            if (a.squishRespawn) {
                Vec3.assign(this.respawn.pos, this.mapStartPos);
                this.quickFall(ig.TERRAIN.HOLE);
            }
        },
        varsChanged: function () {
            this.condition && this.condition.evaluate();
            if (!this.floating && ig.vars.get("playerVar.staticFloat")) {
                this.floating = true;
                this.configs.normal.overwrite("floatHeight", 6);
                this.configs.aiming.overwrite("floatHeight", 6);
                this.setDefaultConfig(this.configs.normal);
            } else if (this.floating &&
                !ig.vars.get("playerVar.staticFloat")) {
                this.floating = false;
                this.configs.normal.clearOverwrite();
                this.configs.aiming.clearOverwrite();
                this.setDefaultConfig(this.configs.normal);
            }
            if (this.recordInput != ig.vars.get("playerVar.recordInput"))
                if (this.recordInput = ig.vars.get("playerVar.recordInput")) {
                    ig.vars.set("playerVar.input.thrown", 0);
                    ig.vars.set("playerVar.input.aiming", false);
                    ig.vars.set("playerVar.input.guardTime", 0);
                    ig.vars.set("playerVar.input.shieldedHits", 0);
                    ig.vars.set("playerVar.input.hits", 0);
                    ig.vars.set("playerVar.input.perfectShield", 0);
                    ig.vars.set("playerVar.input.attackDashCancel", 0);
                    ig.vars.set("playerVar.input.melee", 0);
                }
        },
        modelChanged: function (a, b, c) {
            if (a == this.params)
                b == sc.COMBAT_PARAM_MSG.STATS_CHANGED && this.updateModelStats();
            else if (a == this.model)
                if (b == sc.PLAYER_MSG.ELEMENT_MODE_CHANGE) {
                    this.copyModelSkills();
                    this.updateModelStats();
                } else
                    b == sc.PLAYER_MSG.CONFIG_CHANGED ? this.initModel() : b == sc.PLAYER_MSG.STATS_CHANGED ? this.updateModelStats() : b == sc.PLAYER_MSG.ITEM_USED ? this.itemConsumer.activateItemEffect(this,
                        this.model, c) : b == sc.PLAYER_MSG.ITEM_TOGGLED && this.updateModelStats();
            else
                a == sc.playerSkins ? c == "Appearance" ? this.updateAnimSheet() : c == "StepEffect" ? this.updateSkinStepFx() : c == "Aura" ? this.updateSkinAura() : c == "Pet" && this.updateSkinPet(true) : a == sc.model && b == sc.GAME_MODEL_MSG.STATE_CHANGED && this.updateAnimSheet();
        },
        copyModelSkills: function () {
            this.proxies = this.model.getBalls();
        },
        doQuickRespawn: function (a, b, c) {
            (a == ig.TERRAIN.WATER || a == ig.TERRAIN.HOLE || a == ig.TERRAIN.COAL || a == ig.TERRAIN.QUICKSAND || a == ig.TERRAIN.HIGHWAY) &&
                sc.stats.addMap("player", "respawns", 1);
            a == ig.TERRAIN.WATER ? sc.stats.addMap("player", "waterDeath", 1) : a == ig.TERRAIN.COAL ? sc.stats.addMap("player", "coalDeath", 1) : a == ig.TERRAIN.QUICKSAND ? sc.stats.addMap("player", "sandDeath", 1) : a == ig.TERRAIN.HOLE ? sc.stats.addMap("player", "holeDeath", 1) : a == ig.TERRAIN.HIGHWAY && sc.stats.addMap("player", "highwayDeath", 1);
            this.parent(a, b, c);
        },
        onRespawnEnd: function () {
            for (var a = ig.game.getOverlapEntities(this), b = a.length; b--;) {
                var c = a[b];
                (c instanceof ig.ENTITY.WavePushPullBlock ||
                    c instanceof ig.ENTITY.PushPullBlock) && c.resetPos();
            }
        },
        isThrowCharged: function () {
            return this.gui.crosshair.isThrowCharged();
        },
        setOverrideBall: function (a) {
            this.overrideBall = a;
        },
        useItem: function (a) {
            this.itemConsumer.runItemUseAction(this, this.model, a);
        },
        onVarAccess: function (a, b) {
            return b[1] == "hasElementShield" ? this.hasShield("elementOrbShield") : this.parent(a, b);
        }
    });
}

ig.ENTITY.FloorSwitch.inject({
    isEntitySupported: function (b) {
        return b.isPlayer || b.isPlayer2 ? !this.isOn && !this.switchType.permanent && !ig.CollTools.isMinOverlap(this.coll, b.coll, 4, 4) ? false : true : b instanceof ig.ENTITY.PushPullBlock || b instanceof ig.ENTITY.WavePushPullBlock || b instanceof ig.ENTITY.SlidingBlock ? true : false;
    }
});

ig.ENTITY.WaveTeleport.inject({
    startTeleportAlt: function () {
        if (this.teleportTargets.length == 0) {
            this.teleportTargets.push(ig.game.player2Entity);
            for (var a = sc.party.getPartySize(); a--;) {
                var d = sc.party.getPartyMemberEntityByIndex(a);
                d && this.teleportTargets.push(d);
            }
        }
        d = new ig.Action("waveTeleportAction", [{
            type: "WAIT",
            time: -1
        }
        ]);
        d.eventAction = true;
        for (a = this.teleportTargets.length; a--;) {
            var f = this.teleportTargets[a],
                g = f.getCenter(cachedRingMenuPos);
            this.effects.sheet.spawnFixed("trail", g.x, g.y, f.coll.pos.z + 12, null, {
                target2: this,
                target2Align: ig.ENTITY_ALIGN.CENTER
            });
            this.effects.sheet.spawnOnTarget("hide", f, {
                target2: this,
                target2Align: ig.ENTITY_ALIGN.CENTER
            });
            if (f instanceof ig.ENTITY.Combatant) {
                f.invincibleTimer = -1;
                f.setAction(d);
            }
            f.onTeleportStart && f.onTeleportStart(this);
            f = ig.game.getEntitiesOnTop(f);
            for (g = f.length; g--;)
                f[g] instanceof
                    ig.ENTITY.WavePushPullBlock || this.effects.sheet.spawnOnTarget("hide", f[g], {
                        target2: this,
                        target2Align: ig.ENTITY_ALIGN.CENTER
                    });
        }
        this.teleportTimer = 0.1;
    },
    doTeleport: function () {
        for (var a = 0, d = new ig.Action("waveTeleportAction", [{
            type: "WAIT",
            time: 0
        }
        ]), f = this.teleportTargets.length, g = 0; g < f; ++g) {
            var h = this.teleportTargets[g],
                i = this.getCenter(cachedRingMenuPos);
            h.sendEnemyEvent && h.sendEnemyEvent(sc.COMBAT_ENEMY_EVENT.WAVE_TELEPORT, {
                newPos: i
            });
            if (h instanceof ig.ENTITY.Combatant)
                h.invincibleTimer = 0;
            if (h instanceof sc.PartyMemberEntity)
                h.resetPos();
            else {
                for (var j = ig.game.getEntitiesOnTop(h), k = i.x - h.coll.size.x / 2, i = i.y - h.coll.size.y / 2, l = this.coll.pos.z + a, o = j.length; o--;)
                    if (j[o] instanceof ig.ENTITY.WavePushPullBlock)
                        j[o].coll.setGroundEntry(null);
                    else {
                        this.effects.sheet.spawnOnTarget("show", j[o]);
                        var m = j[o].coll;
                        m.setGroundEntry(null);
                        m.setPos(m.pos.x + k - h.coll.pos.x, m.pos.y + i - h.coll.pos.y, m.pos.z + l - h.coll.pos.z);
                    }
                l = h.getTeleportZOffset ? l + h.getTeleportZOffset() : l + h.coll.float.height;
                h.setPos(k, i, l);
                a = a + h.coll.size.z;
            }
            if (h.isPlayer) {
                ig.camera.isActiveTarget(h.cameraHandle) &&
                    ig.camera.retarget("FASTER", KEY_SPLINES.EASE_IN_OUT);
                d.eventAction = true;
            }
            this.effects.sheet.spawnOnTarget("show", h);
            h.setAction && h.setAction(d);
            h.doTeleport && h.doTeleport(this);
            if (h.isPlayer2) {
                ig.camera.isActiveTarget(h.cameraHandle) &&
                    ig.camera.retarget("FASTER", KEY_SPLINES.EASE_IN_OUT);
                d.eventAction = true;
            }
            this.effects.sheet.spawnOnTarget("show", h);
            h.setAction && h.setAction(d);
            h.doTeleport && h.doTeleport(this);
        }
        this.teleportTargets.length = 0;
    },
    ballHit: function (a) {
        var b = a.getHitCenter(this),
            d = a.getElement();
        if (this.hasBlockOnTop())
            return false;
        var g = (a.isBall || a instanceof sc.CompressedWaveEntity) && a.getCombatantRoot().isPlayer;
        var gg = (a.isBall || a instanceof sc.CompressedWaveEntity) && a.getCombatantRoot().isPlayer2;
        if ((!a.isBall || a.attackInfo.hasHint("CHARGED")) && g && d == sc.ELEMENT.WAVE && !this.teleportTimer) {
            d = a.entityAttached;
            for (g = d.length; g--;)
                if (d[g].doTeleport) {
                    this.teleportTargets.push(d[g]);
                    d.splice(g, 1);
                }
            if (this.teleportTargets.length == 0 && a.isBall && !ig.EntityTools.isInScreen(this, 32) || this.teleportTargets.length == 0 && ig.CollTools.getGroundDistance(this.coll, ig.game.playerEntity.coll) < 48 || this.teleportTargets.length == 0 && ig.game.playerEntity.currentAction && ig.game.playerEntity.currentAction.eventAction)
                return false;
            sc.combat.showHitEffect(this,
                b, sc.ATTACK_TYPE.NONE, a.getElement(), false, false, true);
            this.startTeleport();
            return true;
        }
        if ((!a.isBall || a.attackInfo.hasHint("CHARGED")) && gg && d == sc.ELEMENT.WAVE && !this.teleportTimer) {
            d = a.entityAttached;
            for (gg = d.length; gg--;)
                if (d[gg].doTeleport) {
                    this.teleportTargets.push(d[gg]);
                    d.splice(gg, 1);
                }
            if (this.teleportTargets.length == 0 && a.isBall && !ig.EntityTools.isInScreen(this, 32) || this.teleportTargets.length == 0 && ig.CollTools.getGroundDistance(this.coll, ig.game.player2Entity.coll) < 48 || this.teleportTargets.length == 0 && ig.game.player2Entity.currentAction && ig.game.player2Entity.currentAction.eventAction)
                return false;
            sc.combat.showHitEffect(this,
                b, sc.ATTACK_TYPE.NONE, a.getElement(), false, false, true);
            this.startTeleportAlt();
            return true;
        }
        return false;
    },
});


ig.ACTION_STEP.SET_PARTY_MEMBER_LEVEL = ig.ActionStepBase.extend({
    member: null,
    level: null,
    exp: null,
    updateEquipment: false,
    _wm: new ig.Config({
        attributes: {
            member: {
                _type: "String",
                _info: "Party member to add",
                _select: sc.PARTY_OPTIONS
            },
            level: {
                _type: "Integer",
                _info: "Level to set"
            },
            exp: {
                _type: "Integer",
                _info: "Exp to set"
            },
            updateEquipment: {
                _type: "Boolean",
                _info: "If true, also update equipment of party member"
            }
        }
    }),
    init: function (a) {
        this.member = a.member;
        this.level = a.level || 1;
        this.exp = a.exp || 0;
        this.updateEquipment = a.updateEquipment || false;
    },
    start: function () {
        sc.party.getPartyMemberModel(this.member).setLevel(this.level, this.exp, this.updateEquipment, true);
    }
});

sc.CrossCode.inject({
    isEventStartReady: function () {
        return this.playerEntity && this.playerEntity.isDefeated() && this.player2Entity && this.player2Entity.isDefeated() && !this.playerEntity.manualKill && !this.player2Entity.manualKill &&
            !sc.pvp.isActive() ? false : true;
    },
    loadLevel: function (b, a, d) {
        if (ig.storage.resetAfterTeleport) {
            sc.model.player.regenerate();
            sc.model.player2.regenerate();
            ig.storage.resetAfterTeleport = false;
        }
        sc.model.isCutscene() && sc.model.enterGame();
        this.parent(b, a, d);
    },
});