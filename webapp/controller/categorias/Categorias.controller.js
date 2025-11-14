sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/library",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageToast, MessageBox, Filter, FilterOperator, library, Fragment) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.categorias.Categorias", {

        onInit: function () {
            
            var oModel = new JSONModel({
                categories: [],
                totalCategories: 0,
                searchText: "",
                loading: false,
                errorMessage: "",
                formError: "",
                editingCategory: {},
                availableParents: [],
                selectedCategories: [],
                isEditing: false,
                statusButtonText: "Activar"
            });
            
            this.getView().setModel(oModel, "categoriasModel");
            this.loadCategories();
            this._currentEditingCATID = null;
        },

        loadCategories: function () {
            var oModel = this.getView().getModel("categoriasModel");
            oModel.setProperty("/loading", true);
            oModel.setProperty("/errorMessage", "");

            var that = this;

            // Llamar a la API
            this._callAPI('/ztcategorias/categoriasCRUD', { ProcessType: 'GetAll' }, {})
                .then(function (oResponse) {
                    
                    var aCategories = [];
                    
                    // Procesar respuesta
                    if (oResponse && oResponse.data && Array.isArray(oResponse.data) && oResponse.data.length > 0) {
                        var oFirstRecord = oResponse.data[0];
                        if (oFirstRecord.dataRes && Array.isArray(oFirstRecord.dataRes)) {
                            aCategories = oFirstRecord.dataRes;
                        }
                    }
                    
                    oModel.setProperty("/categories", aCategories);
                    oModel.setProperty("/totalCategories", aCategories.length);
                    oModel.setProperty("/loading", false);
                })
                .catch(function (error) {
                    oModel.setProperty("/errorMessage", "Error al cargar categorías: " + (error.message || "Error desconocido"));
                    oModel.setProperty("/loading", false);
                    oModel.setProperty("/categories", []);
                });
        },

        _callAPI: function (sEndpoint, oParams, oPayload) {
            var sDBServer = sessionStorage.getItem('DBServer') || 'MongoDB';
            
            // Obtener usuario logueado
            var sLoggedUser = '';
            try {
                var sUserJson = localStorage.getItem('currentUser');
                if (sUserJson) {
                    var oUser = JSON.parse(sUserJson);
                    sLoggedUser = oUser.USERID || oUser.username || 'SYSTEM';
                }
            } catch (e) {
                sLoggedUser = 'SYSTEM';
            }
            
            // Construir URL con parámetros
            var sUrl = "/api" + sEndpoint;
            var oAllParams = {
                ProcessType: oParams.ProcessType || 'GetAll',
                DBServer: sDBServer,
                LoggedUser: sLoggedUser
            };
            
            // Si hay más parámetros, agregarlos
            for (var key in oParams) {
                if (key !== 'ProcessType') {
                    oAllParams[key] = oParams[key];
                }
            }
            
            // Convertir parámetros a query string
            var aParams = [];
            for (var key in oAllParams) {
                aParams.push(key + "=" + encodeURIComponent(oAllParams[key]));
            }
            sUrl += "?" + aParams.join("&");

            // Usar fetch API
            return fetch(sUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify(oPayload || {})
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.text().then(function(text) {
                        throw new Error("HTTP Error " + response.status + ": " + text);
                    });
                }
                return response.json();
            })
            .catch(function(error) {
                throw error;
            });
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            var oModel = this.getView().getModel("categoriasModel");
            
            var oTable = this.byId("categoriesTable");
            var oBinding = oTable.getBinding("items");
            
            if (sQuery && sQuery.length > 0) {
                var aFilters = [
                    new Filter("Nombre", FilterOperator.Contains, sQuery),
                    new Filter("CATID", FilterOperator.Contains, sQuery)
                ];
                var oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }

            oModel.setProperty("/searchText", sQuery);
        },

        onNewCategory: function () {
            var oModel = this.getView().getModel("categoriasModel");
            var aCategories = oModel.getProperty("/categories") || [];
            
            oModel.setProperty("/editingCategory", {
                CATID: "",
                Nombre: "",
                PadreCATID: "",
                ACTIVED: true
            });
            
            // Filter available parents (only root categories and those that are parents)
            var availableParents = this._getAvailableParents(aCategories, null);
            oModel.setProperty("/availableParents", availableParents);
            oModel.setProperty("/formError", "");
            
            this._openDialog();
        },

        onEditCategory: function () {
            var oTable = this.byId("categoriesTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona una categoría para editar.");
                return;
            }
            
            if (aSelectedItems.length > 1) {
                MessageBox.warning("Por favor selecciona solo una categoría para editar.");
                return;
            }
            
            var oContext = aSelectedItems[0].getBindingContext("categoriasModel");
            var oCategory = oContext.getObject();
            var oModel = this.getView().getModel("categoriasModel");
            var aCategories = oModel.getProperty("/categories") || [];
            
            // Deep copy to avoid modifying original
            oModel.setProperty("/editingCategory", JSON.parse(JSON.stringify(oCategory)));
            this._currentEditingCATID = oCategory.CATID;
            
            // Filter available parents (exclude current category)
            var availableParents = this._getAvailableParents(aCategories, oCategory.CATID);
            oModel.setProperty("/availableParents", availableParents);
            oModel.setProperty("/formError", "");
            
            this._openDialog();
        },

        onDeleteCategory: function () {
            var oTable = this.byId("categoriesTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona una categoría para eliminar.");
                return;
            }
            
            var that = this;
            var sMessage = aSelectedItems.length === 1 
                ? "¿Estás seguro de que quieres eliminar esta categoría?"
                : "¿Estás seguro de que quieres eliminar " + aSelectedItems.length + " categorías?";
            
            MessageBox.confirm(sMessage, {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._deleteSelectedCategories(aSelectedItems);
                    }
                }
            });
        },

        onTableSelectionChange: function () {
            var oTable = this.byId("categoriesTable");
            var aSelectedItems = oTable.getSelectedItems();
            var oModel = this.getView().getModel("categoriasModel");

            if (aSelectedItems.length === 0) {
                oModel.setProperty("/statusButtonText", "Activar");
                return;
            }

            // Determine if we should show "Activar" or "Desactivar" based on majority state
            var aCategories = aSelectedItems.map(function(item) {
                return item.getBindingContext("categoriasModel").getObject();
            });

            var iActiveCount = aCategories.filter(function(cat) { return cat.ACTIVED; }).length;
            var bActivate = iActiveCount <= aCategories.length / 2; // Activate if less than half are active

            var sButtonText = bActivate ? "Activar" : "Desactivar";
            oModel.setProperty("/statusButtonText", sButtonText);
        },

        onToggleStatus: function () {
            var oTable = this.byId("categoriesTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una categoría.");
                return;
            }
            
            // Determine if we should activate or deactivate based on majority state
            var aCategories = aSelectedItems.map(function(item) {
                return item.getBindingContext("categoriasModel").getObject();
            });
            
            var iActiveCount = aCategories.filter(function(cat) { return cat.ACTIVED; }).length;
            var bActivate = iActiveCount <= aCategories.length / 2; // Activate if less than half are active
            
            var sMessage = bActivate 
                ? "¿Activar " + aSelectedItems.length + " categoría(s)?"
                : "¿Desactivar " + aSelectedItems.length + " categoría(s)?";
            
            var that = this;
            MessageBox.confirm(sMessage, {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._updateStatusForCategories(aCategories, bActivate);
                    }
                }
            });
        },

        onCategoryPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("categoriasModel");
            var oCategory = oContext.getObject();
            
            MessageToast.show("Categoría seleccionada: " + oCategory.Nombre);
        },

        formatDate: function (sDate) {
            if (!sDate) return 'N/A';
            try {
                var date = new Date(sDate);
                return date.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (e) {
                return 'Fecha inválida';
            }
        },

        getStatusText: function (oCategory) {
            if (!oCategory) return "Desconocido";
            if (oCategory.DELETED === true) return "Eliminada";
            if (oCategory.ACTIVED === true) return "Activa";
            return "Inactiva";
        },

        getStatusState: function (oCategory) {
            if (!oCategory) return "Error";
            if (oCategory.DELETED === true) return "Error";
            if (oCategory.ACTIVED === true) return "Success";
            return "Warning";
        },

        _generateCATID: function(sName) {
            if (!sName) return "";
            // Normalize and sanitize: trim, uppercase, replace spaces and special chars with underscore
            var s = sName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
            // Remove leading/trailing underscores and collapse multiple underscores
            s = s.replace(/^_+|_+$/g, "").replace(/_+/g, "_");
            return s ? "CAT_" + s : "";
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteMain", {}, true);
            }
        },

        // Dialog Management Methods
        _openDialog: function () {
            var oView = this.getView();
            
            if (!oView.byId("categoryDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.categorias.fragments.CategoryDetailDialog",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                oView.byId("categoryDialog").open();
            }
        },

        onCloseDialog: function () {
            var oView = this.getView();
            var oDialog = oView.byId("categoryDialog");
            if (oDialog) {
                oDialog.close();
            }
        },

        onCategoryNameChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oModel = this.getView().getModel("categoriasModel");
            var oEditingCategory = oModel.getProperty("/editingCategory");
            
            // Generate CATID from Nombre if it's new (format: CAT_NOMBRE)
            if (!this._currentEditingCATID && sValue) {
                var sGeneratedCATID = this._generateCATID(sValue);
                oModel.setProperty("/editingCategory/CATID", sGeneratedCATID);
            }
        },

        onParentCategoryChange: function (oEvent) {
            var oModel = this.getView().getModel("categoriasModel");
            var oEditingCategory = oModel.getProperty("/editingCategory");
            
            // Regenerate CATID when parent changes (only for NEW categories, format: CAT_NOMBRE)
            if (!this._currentEditingCATID && oEditingCategory.Nombre) {
                var sGeneratedCATID = this._generateCATID(oEditingCategory.Nombre);
                oModel.setProperty("/editingCategory/CATID", sGeneratedCATID);
            }
        },

        onSaveCategory: function () {
            var oModel = this.getView().getModel("categoriasModel");
            var oEditingCategory = oModel.getProperty("/editingCategory");
            
            // Validation
            if (!oEditingCategory.Nombre || !oEditingCategory.Nombre.trim()) {
                oModel.setProperty("/formError", "El nombre de la categoría es requerido.");
                return;
            }
            
            if (!oEditingCategory.CATID) {
                oModel.setProperty("/formError", "El identificador (CATID) es requerido.");
                return;
            }
            
            oModel.setProperty("/formError", "");
            
            var that = this;
            var bIsEdit = !!this._currentEditingCATID;
            
            if (bIsEdit) {
                // Update existing category - payload must include all fields to update
                var oUpdatePayload = {
                    CATID: oEditingCategory.CATID,
                    Nombre: oEditingCategory.Nombre,
                    PadreCATID: oEditingCategory.PadreCATID || null,
                    ACTIVED: oEditingCategory.ACTIVED !== undefined ? oEditingCategory.ACTIVED : true
                };
                
                this._callAPI('/ztcategorias/categoriasCRUD', 
                    { ProcessType: 'UpdateOne', CATID: this._currentEditingCATID }, 
                    oUpdatePayload)
                    .then(function(oResponse) {
                        MessageToast.show("Categoría actualizada correctamente");
                        that.onCloseDialog();
                        that._currentEditingCATID = null;
                        that.loadCategories();
                    })
                    .catch(function(error) {
                        oModel.setProperty("/formError", "Error al actualizar: " + (error.message || "Error desconocido"));
                    });
            } else {
                // Create new category
                var oCreatePayload = {
                    CATID: oEditingCategory.CATID,
                    Nombre: oEditingCategory.Nombre,
                    PadreCATID: oEditingCategory.PadreCATID || null,
                    ACTIVED: true
                };
                
                this._callAPI('/ztcategorias/categoriasCRUD', 
                    { ProcessType: 'AddOne' }, 
                    oCreatePayload)
                    .then(function(oResponse) {
                        MessageToast.show("Categoría creada correctamente");
                        that.onCloseDialog();
                        that._currentEditingCATID = null;
                        that.loadCategories();
                    })
                    .catch(function(error) {
                        oModel.setProperty("/formError", "Error al crear: " + (error.message || "Error desconocido"));
                    });
            }
        },

        onDeleteFromModal: function () {
            var oModel = this.getView().getModel("categoriasModel");
            var oEditingCategory = oModel.getProperty("/editingCategory");
            var that = this;
            
            if (!oEditingCategory.CATID) {
                MessageBox.error("No se puede eliminar una categoría sin CATID");
                return;
            }
            
            MessageBox.confirm("¿Eliminar permanentemente esta categoría?", {
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._deleteCategory(oEditingCategory.CATID);
                    }
                }
            });
        },

        _deleteCategory: function(sCATID) {
            var oModel = this.getView().getModel("categoriasModel");
            var that = this;
            
            this._callAPI('/ztcategorias/categoriasCRUD', 
                { ProcessType: 'DeleteHard', CATID: sCATID }, 
                {})
                .then(function(oResponse) {
                    MessageToast.show("Categoría eliminada correctamente");
                    that.onCloseDialog();
                    that._currentEditingCATID = null;
                    that.loadCategories();
                })
                .catch(function(error) {
                    oModel.setProperty("/formError", "Error al eliminar: " + (error.message || "Error desconocido"));
                });
        },

        _deleteSelectedCategories: function(aSelectedItems) {
            var that = this;
            var aCategories = aSelectedItems.map(function(item) {
                return item.getBindingContext("categoriasModel").getObject();
            });
            
            var oModel = this.getView().getModel("categoriasModel");
            oModel.setProperty("/loading", true);
            
            // Delete each category sequentially
            var iDeleted = 0;
            var deleteNext = function() {
                if (iDeleted >= aCategories.length) {
                    oModel.setProperty("/loading", false);
                    MessageToast.show("Categorías eliminadas correctamente");
                    that.byId("categoriesTable").removeSelections();
                    that.loadCategories();
                    return;
                }
                
                var oCat = aCategories[iDeleted];
                that._callAPI('/ztcategorias/categoriasCRUD', 
                    { ProcessType: 'DeleteHard', CATID: oCat.CATID }, 
                    {})
                    .then(function() {
                        iDeleted++;
                        deleteNext();
                    })
                    .catch(function(error) {
                        oModel.setProperty("/loading", false);
                        oModel.setProperty("/errorMessage", "Error al eliminar " + oCat.CATID);
                    });
            };
            
            deleteNext();
        },

        _updateStatusForCategories: function(aCategories, bActivate) {
            var that = this;
            var oModel = this.getView().getModel("categoriasModel");
            oModel.setProperty("/loading", true);
            
            var iUpdated = 0;
            var updateNext = function() {
                if (iUpdated >= aCategories.length) {
                    oModel.setProperty("/loading", false);
                    MessageToast.show("Estado actualizado correctamente");
                    that.byId("categoriesTable").removeSelections();
                    that.loadCategories();
                    return;
                }
                
                var oCat = aCategories[iUpdated];
                var oPayload = {
                    CATID: oCat.CATID,
                    Nombre: oCat.Nombre,
                    PadreCATID: oCat.PadreCATID || null,
                    ACTIVED: bActivate
                };
                
                that._callAPI('/ztcategorias/categoriasCRUD', 
                    { ProcessType: 'UpdateOne', CATID: oCat.CATID }, 
                    oPayload)
                    .then(function() {
                        iUpdated++;
                        updateNext();
                    })
                    .catch(function(error) {
                        oModel.setProperty("/loading", false);
                        oModel.setProperty("/errorMessage", "Error al actualizar estado de " + oCat.CATID);
                    });
            };
            
            updateNext();
        },

        _getAvailableParents: function(aCategories, sCurrentCATID) {
            if (!Array.isArray(aCategories)) {
                return [];
            }
            
            // Find categories that have children (are parents)
            var parentIds = new Set();
            aCategories.forEach(function(cat) {
                if (cat.PadreCATID) {
                    parentIds.add(cat.PadreCATID);
                }
            });
            
            // Filter categories that:
            // 1. Are root categories (no PadreCATID) OR already have children
            // 2. Are not the current category being edited
            return aCategories.filter(function(cat) {
                return (!sCurrentCATID || cat.CATID !== sCurrentCATID) &&
                       (!cat.PadreCATID || parentIds.has(cat.CATID));
            });
        }
    });
});
