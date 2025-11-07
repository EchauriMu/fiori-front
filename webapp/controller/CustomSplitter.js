sap.ui.define([
    "sap/ui/layout/Splitter"
], function(Splitter) {
    return Splitter.extend("com.invertions.sapfiorimodinv.controller.CustomSplitter", {
        metadata: {},
        renderer: {},
        onAfterRendering: function() {
            Splitter.prototype.onAfterRendering.apply(this, arguments);
            var oSplitterBar = this.$().find(".sapUiLoSplitterBar");
            var that = this;
            if (oSplitterBar.length) {
                oSplitterBar.off("dblclick.custom").on("dblclick.custom", function() {
                    that._toggleSplitterSize();
                });
            }
        },
        _toggleSplitterSize: function() {
            var aContentAreas = this.getContentAreas();
            var oLeftPanel = aContentAreas[0];
            var oRightPanel = aContentAreas[1];
            var oLeftLayoutData = oLeftPanel.getLayoutData();
            var oRightLayoutData = oRightPanel.getLayoutData();

            // Alternar entre 100/0 y 50/50
            var leftSize = oLeftLayoutData.getSize();
            if (leftSize === "100%" || leftSize === "100%") {
                oLeftLayoutData.setSize("50%");
                oRightLayoutData.setSize("50%");
            } else {
                oLeftLayoutData.setSize("100%");
                oRightLayoutData.setSize("0px");
            }
        }
    });
});