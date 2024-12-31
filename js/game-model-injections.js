console.log("log test 1");
sc.GameModel.inject({
        emilieConfig: new sc.PlayerConfig("Schneider"),
        player2: null,
        init: function () {
        	this.player2 = new sc.PlayerModelTwo;
            this.player2.setConfig(this.emilieConfig);
            console.log("game model inject done");
            this.parent();
        },
});