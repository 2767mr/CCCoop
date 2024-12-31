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
            sc.combat.doDramaticEffect(ig.game.player2Entity, ig.game.player2Entity, sc.DRAMATIC_EFFECT.OVERLOAD);
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

sc.BigHpBar.inject({
    _isHpBarVisible: function () {
        if (!ig.vars.get("tmp.playerOppose")) {
            return this.parent();
        }
    },
});

sc.GameModel.inject({
    emilieConfig: new sc.PlayerConfig("Emilie"),
    player2: null,
    init() {
        this.parent();
        this.player2 = new sc.PlayerModel();
        this.player2.setConfig(this.emilieConfig);
    },
    onReset() {
        this.player2.setConfig(this.emilieConfig);
        this.player2.reset();
        this.parent();
    }
});

ig.EVENT_STEP.GIVE_ITEM_ALT = ig.EVENT_STEP.GIVE_ITEM.extend({
    start: replacePlayerModel,
});
ig.EVENT_STEP.ADD_CP_ALT = ig.EVENT_STEP.ADD_CP.extend({
    start: replacePlayerModel,
});
ig.EVENT_STEP.INCREASE_PLAYER_SP_LEVEL_ALT = ig.EVENT_STEP.INCREASE_PLAYER_SP_LEVEL.extend({
    start: replacePlayerModel,
});
ig.EVENT_STEP.ADD_PLAYER_EXP_ALT = ig.EVENT_STEP.ADD_PLAYER_EXP.extend({
    start: replacePlayerModel,
});
ig.EVENT_STEP.SET_PLAYER_LEVEL_DEBUG_ALT = ig.EVENT_STEP.SET_PLAYER_LEVEL_DEBUG.extend({
    start: replacePlayerModel,
});

sc.PvpModel.inject({
    onPostKO(party) {
        ig.game.player2Entity.regenPvp(b);
        this.parent(party);
    }
});

sc.SpecialSkill.inject({
    getNameAlt: replacePlayerModelIn(function() {
        this.getName();
    }),
    getDescriptionAlt: replacePlayerModelIn(function() {
        this.getDescription();
    }),
});

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
                                        this.focusEntry.handler.onInteraction && this.focusEntry.handler.onInteraction();
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
})

//TODO: sc.ItemConsumption

sc.CrossCode.inject({
    isEventStartReady() {
        if (!this.player2Entity || !this.player2Entity.isDefeated() || this.player2Entity.manualKill) {
            return true;
        }
        return this.parent();
    },
    loadLevel(...args) {
        if (ig.storage.resetAfterTeleport) {
            sc.model.player2.regenerate();
        }
        this.parent(...args);
    }
})

ig.ENTITY.PlayerTwo = ig.ENTITY.Player.extend({
    isPlayer: true,
    isPlayer2: true,
    init(...args) {
        const original = sc.model;
        sc.model = null;

        this.parent(...args);
        
        sc.model = original;

        if (sc.model) {
            this.model = sc.model.player2;
            sc.Model.addObserver(this.model, this);
            sc.Model.addObserver(sc.model, this);
            this.initModel();
        }

        // const seen = new Set();

        // Object.defineProperty(this, 'isPlayer', {
        //     configurable: true,
        //     get() {
        //         const origin = new Error().stack.split('\n').slice(2, 3).join('\n');
        //         if (!seen.has(origin)) {
        //             seen.add(origin);
        //             console.log(origin);
        //         }
        //         return false;
        //     },
        //     set() {
        //         return true;
        //     }
        // });
    },
});

// ig.ENTITY.Combatant.inject({
//     damage(...args) {
//     },
// })

sc.StatusElementModeGui2 = sc.StatusElementModeGui.extend({
    updateDrawables: replacePlayerModel,
});
// sc.ParamHudGui2 = sc.ParamHudGui.extend({
//     init: replacePlayerModel,
// });

// const paramHudGuiMixin = {
//     isPlayer2: false,
//     init(...args) {
//         this.parent(...args);
//         this.isPlayer2 = sc.model.player === sc.model.player2;
//     },
//     modelChanged(...args) {
//         const original = sc.model.player;
//         if (this.isPlayer2) {
//             sc.model.player = sc.model.player2;
//         }

//         this.parent(...args);

//         if (this.isPlayer2) {
//             sc.model.player = original;
//         }
//     },
// };

// sc.ParamHudGui.Pie.inject(paramHudGuiMixin);
// sc.ParamHudGui.Param.inject(paramHudGuiMixin);
// sc.ParamHudGui.Level.inject(paramHudGuiMixin);

const statusHudGuiOffsets = [{
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
}
];
sc.StatusHudGui.inject({
    elementBgGui2: null,
    elementModeGui2: null,
    paramGui2: null,
    init() {
        this.parent();
        
        this.elementBgGui2 = new sc.StatusElementBgGui;
        this.elementBgGui2.setPos(3, 53);
        this.addChildGui(this.elementBgGui2);
        this.elementModeGui2 = new sc.StatusElementModeGui2;
        this.elementModeGui2.setPos(0, 50);
        this.addChildGui(this.elementModeGui2);
        // this.paramGui2 = new sc.ParamHudGui2;
        // this.paramGui2.setPos(54, 76);
        // this.addChildGui(this.paramGui2);
        sc.Model.addObserver(sc.model.player2, this);
            
    },
    modelChanged(sender, message, options) {
        if (sender === sc.model.player2) {
            if (message == sc.PLAYER_MSG.ELEMENT_MODE_CHANGE) {
                this.elementSwitchDisplay();
            } else if (message == sc.PLAYER_MSG.ITEM_CONSUME_START) {
                this.elementSwitchTimer = 100;
            } else if (message == sc.PLAYER_MSG.ITEM_CONSUME_END) {
                this.elementSwitchTimer = options ? 1.5 : 1E-4
            }
        } else {
            this.parent(sender, message, options);
        }
    },
    _minimizeDisplay() {
        this.parent();

        this.elementModeGui2.doPosTranstition(0, 50, 0.3, KEY_SPLINES.EASE_IN_OUT);
        this.elementModeGui2.selectBg = false;
        this.elementBgGui2.doStateTransition("HIDDEN");
        
        // this.paramGui2.hideParams();
    },
    _minimizeDisplayFast() {
        this.parent();

        this.elementModeGui2.doPosTranstition(0, 50, 0.2, KEY_SPLINES.EASE_IN_OUT);
        this.elementModeGui2.selectBg = false;
        this.elementBgGui2.doStateTransition("HIDDEN_MENU");
        
        // this.paramGui2.hideParams();
    },
    _enterQuickMenuMode() {
        this.parent();
        var aa = sc.model.player2.currentElementMode;
        this.elementBgGui2.doStateTransition("QUICKMENU");
        aa = b[aa];
        this.elementModeGui2.doPosTranstition(aa.x + 3, aa.y + 53, 0.2, KEY_SPLINES.EASE);
        this.elementModeGui2.doStateTransition("QUICKMENU");
        this.elementModeGui2.selectBg = true;
        // this.paramGui2.showParams(false);
    },
    _enterMenuMode() {
        this.parent();

        var aa = sc.model.player2.currentElementMode;
        this.elementBgGui2.doStateTransition("MENU");
        aa = statusHudGuiOffsets[aa];
        this.elementModeGui2.doPosTranstition(aa.x + 3 + 2, aa.y + 53 + 21, 0.2, KEY_SPLINES.EASE);
        this.elementModeGui2.doStateTransition("MENU");
        this.elementModeGui2.selectBg = true;
        
        // this.paramGui2.showParams(true);
    },
    elementSwitchDisplay() {
        this.parent();
        var aa = sc.model.player2.currentElementMode;
            
        this.elementBgGui2.doStateTransition("DEFAULT");
        aa = statusHudGuiOffsets[aa];
        this.elementModeGui2.setPos(aa.x + 3, aa.y + 53);
        this.elementModeGui2.doStateTransition("ZOOM", true);
        this.elementModeGui2.doStateTransition("DEFAULT");
        this.elementModeGui2.selectBg = true;
        
        // this.paramGui2.showParams(false);
    },
});

sc.HpHudGui2 = sc.HpHudGui.extend({
    init: replacePlayerModel,
    update: replacePlayerModel,
    modelChanged: replacePlayerModel,
});

sc.SpHudGui2 = sc.SpHudGui.extend({
    init: replacePlayerModel,
    update: replacePlayerModel,
    updateDrawables: replacePlayerModel,
    modelChanged: replacePlayerModel,
});

sc.ExpHudGui2 = sc.ExpHudGui.extend({
    init: replacePlayerModel,
    modelChanged: replacePlayerModel,
});

sc.StatusUpperGui.inject({
    init() {
        this.parent();
        var b = new sc.HpHudGui2;
        b.setPos(0, 50);
        this.addChildGui(b);
        b = new sc.SpHudGui2;
        this.addChildGui(b);
        b.setPos(55, 50);
        b = new sc.ExpHudGui2;
        b.setPos(63, 58);
        this.addChildGui(b);
    }
});