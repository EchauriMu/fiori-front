sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageToast"
], function (Object, MessageToast) {
    "use strict";

    return Object.extend("com.invertions.sapfiorimodinv.controller.listasprecios.AdvancedFilters", {

        constructor: function (oController) {
            this.oController = oController;
            this.oModel = null;
        },

        setModel: function (oModel) {
            this.oModel = oModel;
        },

        // Búsqueda de marcas
        onSearchMarcasChange: function (oEvent) {
            const sSearchTerm = oEvent.getParameter("newValue") || "";
            this.oModel.setProperty("/searchMarcas", sSearchTerm);
            this._filterMarcas();
        },

        // Toggle marca
        onToggleMarca: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const oMarca = oContext.getObject();
            const bSelected = oSource.getSelected();
            
            oMarca.selected = bSelected;
            oContext.getModel().refresh(true);
            
            // Actualizar selectedMarcas
            const aSelectedMarcas = this.oModel.getProperty("/selectedMarcas") || [];
            if (bSelected && !aSelectedMarcas.includes(oMarca.name)) {
                aSelectedMarcas.push(oMarca.name);
            } else if (!bSelected) {
                const iIndex = aSelectedMarcas.indexOf(oMarca.name);
                if (iIndex > -1) {
                    aSelectedMarcas.splice(iIndex, 1);
                }
            }
            
            this.oModel.setProperty("/selectedMarcas", aSelectedMarcas);
            this.oController._applyFilters();
        },

        // Remover marca
        onRemoveMarca: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const sMarcaName = oContext.getObject();
            const aSelectedMarcas = this.oModel.getProperty("/selectedMarcas") || [];
            const iIndex = aSelectedMarcas.indexOf(sMarcaName);
            
            if (iIndex > -1) {
                aSelectedMarcas.splice(iIndex, 1);
                this.oModel.setProperty("/selectedMarcas", aSelectedMarcas);
                
                // Actualizar selected en availableMarcas
                const aAvailableMarcas = this.oModel.getProperty("/availableMarcas") || [];
                const oMarcaItem = aAvailableMarcas.find(m => m.name === sMarcaName);
                if (oMarcaItem) {
                    oMarcaItem.selected = false;
                }
                
                this._filterMarcas();
                this.oController._applyFilters();
            }
        },

        // Filtrar marcas
        _filterMarcas: function () {
            const aAllMarcas = this.oModel.getProperty("/availableMarcas") || [];
            const sSearchTerm = (this.oModel.getProperty("/searchMarcas") || "").toLowerCase();
            
            const aFiltered = aAllMarcas.filter(marca => 
                marca.name.toLowerCase().includes(sSearchTerm)
            );
            
            this.oModel.setProperty("/filteredMarcas", aFiltered);
        },

        // Búsqueda de categorías
        onSearchCategoriasChange: function (oEvent) {
            const sSearchTerm = oEvent.getParameter("newValue") || "";
            this.oModel.setProperty("/searchCategorias", sSearchTerm);
            this._filterCategorias();
        },

        // Toggle categoría
        onToggleCategoria: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const oCategoria = oContext.getObject();
            const bSelected = oSource.getSelected();
            
            oCategoria.selected = bSelected;
            oContext.getModel().refresh(true);
            
            // Actualizar selectedCategories
            const aSelectedCategories = this.oModel.getProperty("/selectedCategories") || [];
            if (bSelected && !aSelectedCategories.includes(oCategoria.name)) {
                aSelectedCategories.push(oCategoria.name);
            } else if (!bSelected) {
                const iIndex = aSelectedCategories.indexOf(oCategoria.name);
                if (iIndex > -1) {
                    aSelectedCategories.splice(iIndex, 1);
                }
            }
            
            this.oModel.setProperty("/selectedCategories", aSelectedCategories);
            this.oController._applyFilters();
        },

        // Remover categoría
        onRemoveCategoria: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const sCategoriaName = oContext.getObject();
            const aSelectedCategories = this.oModel.getProperty("/selectedCategories") || [];
            const iIndex = aSelectedCategories.indexOf(sCategoriaName);
            
            if (iIndex > -1) {
                aSelectedCategories.splice(iIndex, 1);
                this.oModel.setProperty("/selectedCategories", aSelectedCategories);
                
                // Actualizar selected en allCategories
                const aAllCategories = this.oModel.getProperty("/allCategories") || [];
                const oCategoriaItem = aAllCategories.find(c => c.name === sCategoriaName);
                if (oCategoriaItem) {
                    oCategoriaItem.selected = false;
                }
                
                this._filterCategorias();
                this.oController._applyFilters();
            }
        },

        // Filtrar categorías
        _filterCategorias: function () {
            const aAllCategories = this.oModel.getProperty("/allCategories") || [];
            const sSearchTerm = (this.oModel.getProperty("/searchCategorias") || "").toLowerCase();
            
            const aFiltered = aAllCategories.filter(categoria => 
                categoria.name.toLowerCase().includes(sSearchTerm)
            );
            
            this.oModel.setProperty("/filteredCategories", aFiltered);
        }

    });
});
