

ig.ENTITY.Player.inject({
    playerNum: 1,

    update() {
        ig.input.currentPlayer = this.playerNum;
        this.parent();
        ig.input.currentPlayer = 0;
    }
});

//Fast enough to keep up with running speed but not fast enough to cause nausea when one player jumps up.
ig.Camera.SPEED_OPTIONS.EVEN_FASTESTESTER = 0.0075;

ig.ENTITY.PlayerTwo.inject({
    playerNum: 1,

    update() {
        ig.input.currentPlayer = this.playerNum;
        this.parent();
        ig.input.currentPlayer = 2;
        if (!sc.model.isCutscene()) {
            this.cameraHandle = new ig.Camera.TargetHandle(new ig.Camera.MultiEntityTarget([this, ig.game.playerEntity]), 0, 0); 
        ig.camera.pushTarget(this.cameraHandle, "EVEN_FASTESTESTER", KEY_SPLINES.EASE_IN_OUT)
        }
    }
});
ig.Input.inject({
    //0 indicates "global"
    currentPlayer: 0,
    tempPlayer: 0,

    setTempPlayer(playerNum) {
        if(!this.tempPlayer) this.tempPlayer = this.currentPlayer;
        this.currentPlayer = playerNum;
    },
    resetTempPlayer() {
        if(this.tempPlayer) {
            this.currentPlayer = this.tempPlayer;
            this.tempPlayer = 0;
        }
    },

    state(name) {
        if(this.currentPlayer == 2) return false;
        else return this.parent(name);
    },
    pressed(name) {
        if(this.currentPlayer == 2) return false;
        else return this.parent(name);
    },
    keyupd(name) {
        if(this.currentPlayer == 2) return false;
        else return this.parent(name);
    }
});
ig.GamepadManager.inject({
    isButtonPressed(button) {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent(button);
    },
    isButtonReleased(button) {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent(button);
    },
    isButtonDown(button) {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent(button);
    },
    getButtonValue(button) {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent(button);
    },

    getAxesValue(axis, clipDeadZone) {
        if(ig.input.currentPlayer == 1) return 0;
        else return this.parent(axis, clipDeadZone)
    },
    isAxesDown(axis) {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent(axis)
    },
    isLeftStickDown() {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent();
    },
    isRightStickDown() {
        if(ig.input.currentPlayer == 1) return false;
        else return this.parent();
    }
})

sc.PlayerCrossHairController.inject({
    isAiming() {
        if(this.gamepadMode) ig.input.setTempPlayer(2);
        let parent = this.parent();
        ig.input.resetTempPlayer();
        return parent;
    },
    getAimingDistance(a, b) {
        if(this.gamepadMode) ig.input.setTempPlayer(2);
        let parent = this.parent(a, b);
        ig.input.resetTempPlayer();
        return parent;
    },
    onActiveChange(a) {
        if(this.gamepadMode) ig.input.setTempPlayer(2);
        let parent = this.parent(a);
        ig.input.resetTempPlayer();
        return parent;
    },
    updatePos(a) {
        if(this.gamepadMode) ig.input.setTempPlayer(2);
        let parent = this.parent(a);
        ig.input.resetTempPlayer();
        return parent;
    },
});

ig.game.addons.levelLoaded.push({
    onLevelLoaded() {
        ig.game.player2Entity = ig.game.spawnEntity("PlayerTwo", ig.game.playerEntity.coll.pos.x, ig.game.playerEntity.coll.pos.y, ig.game.playerEntity.coll.pos.z, {});

        ig.game.playerEntity.playerNum = 1;
        ig.game.player2Entity.playerNum = 2;

        
    }
});

