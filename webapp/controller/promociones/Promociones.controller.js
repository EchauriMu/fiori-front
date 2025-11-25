sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/format/DateFormat",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageToast, MessageBox, Filter, FilterOperator, DateFormat, VBox, Text, Fragment) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.promociones.Promociones", {

        // ================================================================================
        // 1. LIFECYCLE METHODS
        // ================================================================================

        onInit: function () {
            
            // Modelo con datos para promociones
            var oModel = new JSONModel({
                promotions: [],
                totalPromotions: 0,
                activePromotions: 0,
                averageDiscount: 0,
                searchText: "",
                selectedCount: 0,
                statusFilter: "all",
                hasActiveSelected: false
            });
            
            this.getView().setModel(oModel, "promotionsModel");
            
            // Modelo para edición de promociones
            this.getView().setModel(new JSONModel({}), "editPromoModel");
            // Modelo para edición masiva de promociones
            this.getView().setModel(new JSONModel({
                selectedIds: [],
                saving: false,
                errorMessage: "",
                fields: {
                    updateTitulo: false, Titulo: "",
                    updateDescripcion: false, Descripcion: "",
                    updateFechaIni: false, FechaIni: "",
                    updateFechaFin: false, FechaFin: "",
                    updateTipoDescuento: false, TipoDescuento: "PORCENTAJE",
                    updateDescuentoPorcentaje: false, DescuentoPorcentaje: 0,
                    updateDescuentoMonto: false, DescuentoMonto: 0,
                    updateActived: false, ACTIVED: true
                }
            }), "bulkEditModel");
            
            // Modelo para filtrado de productos (usado en di�logo de agregar productos)
            this.getView().setModel(new JSONModel({
                allProducts: [],
                filteredProducts: [],
                paginatedProducts: [],
                selectedPresentaciones: {},        // Selecciones temporales (antes de agregar)
                addedPresentaciones: {},         // Agregadas (bloqueadas hasta modo gesti�n)
                alreadyInPromotion: {},             // Ya est�n en la promoci�n en BD
                productPresentaciones: {},
                loading: false,
                errorMessage: "",
                categories: [],
                brands: [],
                searchTerm: "",
                filters: {
                    category: [],
                    brand: [],
                    minPrice: null,
                    maxPrice: null,
                    startDate: null,
                    endDate: null
                },
                pagination: {
                    currentPage: 1,
                    pageSize: 10,
                    totalPages: 1
                },
                sortBy: "default",
                showOnlyAdded: false,
                isManagingSelection: false,
                hasTemporarySelections: false       // Indica si hay selecciones temporales para mostrar bot�n Agregar
            }), "filterModel");
            
            // Cargar datos automáticamente desde la API
            this.loadPromotions();

            // Conectar con el router
            this.getOwnerComponent().getRouter().getRoute("RoutePromociones")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            const oModel = this.getView().getModel("promotionsModel");
            const aPromotions = oModel.getProperty("/promotions");
            
            // Verificar si hay un flag que indique que se debe recargar
            const bNeedsReload = this.getOwnerComponent().getModel("appView")?.getProperty("/needsPromotionsReload");
            
            if (bNeedsReload) {
                // Limpiar flag y forzar recarga
                this.getOwnerComponent().getModel("appView")?.setProperty("/needsPromotionsReload", false);
                this.forceReloadPromotions();
            } else if (!aPromotions || aPromotions.length === 0) {
                // Solo recargar si no hay datos cargados
                this.loadPromotions();
            }
        },

        // ================================================================================
        // 2. API METHODS - CRUD OPERATIONS (CRÍTICAS PARA DEBUGGING)
        // ================================================================================

        _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

            // Construir query string manualmente para manejar arrays correctamente
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(oParams)) {
                if (Array.isArray(value)) {
                    // Para arrays, agregar cada elemento con el mismo nombre de parámetro
                    value.forEach(item => params.append(key, item));
                } else {
                    params.append(key, value);
                }
            }

            const sQueryString = params.toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
            try {
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(oData || {})
                });

                if (!oResponse.ok) {
                    const oErrorJson = await oResponse.json();
                    const sErrorMessage = oErrorJson.message || `Error ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();
                return oJson;
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        loadPromotions: async function () {
            const oModel = this.getView().getModel("promotionsModel");
            
            try {
                const oResponse = await this._callApi('/ztpromociones/crudPromociones', 'POST', {}, { 
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
                // Estructura específica de tu API: value[0].data[0].dataRes
                let aPromotions = [];
                
                if (oResponse && oResponse.value && Array.isArray(oResponse.value) && oResponse.value.length > 0) {
                    const mainResponse = oResponse.value[0];
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        if (dataResponse.dataRes && Array.isArray(dataResponse.dataRes)) {
                            aPromotions = dataResponse.dataRes;
                        }
                    }
                }
                
                                
                // Calcular estadísticas
                const activePromotions = aPromotions.filter(p => this._isPromotionActive(p)).length;
                const totalDiscount = aPromotions.reduce((sum, p) => {
                    const discount = p.DescuentoPorcentaje || p['Descuento%'] || 0;
                    return sum + parseFloat(discount);
                }, 0);
                const avgDiscount = aPromotions.length > 0 ? (totalDiscount / aPromotions.length).toFixed(1) : 0;
                
                oModel.setProperty("/promotions", aPromotions);
                oModel.setProperty("/totalPromotions", aPromotions.length);
                oModel.setProperty("/activePromotions", activePromotions);
                oModel.setProperty("/averageDiscount", avgDiscount);
                
                MessageToast.show(`${aPromotions.length} promociones cargadas desde el servidor`);
                
            } catch (error) {
                console.error("Error al cargar promociones:", error);
                MessageBox.error("Error al cargar promociones: " + error.message);
                
                // Establecer valores por defecto en caso de error
                oModel.setProperty("/promotions", []);
                oModel.setProperty("/totalPromotions", 0);
                oModel.setProperty("/activePromotions", 0);
                oModel.setProperty("/averageDiscount", 0);
            } finally {
                oModel.setProperty("/busy", false);
                this._isLoadingPromotions = false;
            }
        },

        /**
         * Forzar recarga de promociones (usar después de crear/editar/eliminar)
         */
        forceReloadPromotions: function() {
            this._isLoadingPromotions = false; // Resetear flag
            this.loadPromotions();
        },

        // ================================================================================
        // 3. DIALOG MANAGEMENT & EDIT OPERATIONS
        // ================================================================================

        _isPromotionActive: function(oPromotion) {
            if (!oPromotion) return false;
            if (oPromotion.DELETED === true || oPromotion.ACTIVED === false) return false;
            
            const now = new Date();
            const startDate = new Date(oPromotion.FechaIni);
            const endDate = new Date(oPromotion.FechaFin);
            
            return now >= startDate && now <= endDate;
        },

        // ================================================================================
        // 4. FORMATTERS & HELPERS (less critical for debugging)
        // ================================================================================
        
        formatDate: function(sDate) {
            if (!sDate) return "N/A";
            try {
                const oDate = new Date(sDate);
                const oDateFormat = DateFormat.getDateInstance({
                    pattern: "dd/MM/yyyy"
                });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "Fecha inválida";
            }
        },

        getVigenciaStatus: function(oPromotion) {
            if (!oPromotion) return "Desconocido";
            return this._isPromotionActive(oPromotion) ? "VIGENTE" : "No vigente";
        },

        getVigenciaState: function(oPromotion) {
            if (!oPromotion) return "None";
            return this._isPromotionActive(oPromotion) ? "Success" : "Warning";
        },

        getPromotionStatus: function(oPromotion) {
            if (!oPromotion) return "Desconocido";
            
            if (oPromotion.DELETED === true || oPromotion.ACTIVED === false) {
                return "Inactiva";
            }
            
            const now = new Date();
            const startDate = new Date(oPromotion.FechaIni);
            const endDate = new Date(oPromotion.FechaFin);
            
            if (now < startDate) return "Programada";
            if (now > endDate) return "Expirada";
            return "Activa";
        },

        getPromotionStatusState: function(oPromotion) {
            const status = this.getPromotionStatus(oPromotion);
            switch (status) {
                case "Activa": return "Success";
                case "Programada": return "Information";
                case "Expirada": return "Error";
                case "Inactiva": return "Warning";
                default: return "None";
            }
        },

        onSelectionChange: function(oEvent) {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            const oModel = this.getView().getModel("promotionsModel");
            
            // Contar activas e inactivas
            let activeCount = 0;
            let inactiveCount = 0;
            
            aSelectedItems.forEach(oItem => {
                const oContext = oItem.getBindingContext("promotionsModel");
                const oPromotion = oContext.getObject();
                if (oPromotion.ACTIVED === true && oPromotion.DELETED !== true) {
                    activeCount++;
                } else {
                    inactiveCount++;
                }
            });
            
            // Determinar el estado: true si hay activas, false si solo inactivas, null si mixtas
            let hasActiveSelected;
            if (activeCount > 0 && inactiveCount === 0) {
                hasActiveSelected = true; // Solo activas
            } else if (inactiveCount > 0 && activeCount === 0) {
                hasActiveSelected = false; // Solo inactivas
            } else if (activeCount > 0 && inactiveCount > 0) {
                hasActiveSelected = null; // Mixtas
            } else {
                hasActiveSelected = false; // Default
            }
            
            oModel.setProperty("/selectedCount", aSelectedItems.length);
            oModel.setProperty("/hasActiveSelected", hasActiveSelected);
        },

        // ================================================================================
        // 5. UI EVENT HANDLERS
        // ================================================================================

        onRowPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oTable = this.byId("promotionsTable");
            const bSelected = oItem.getSelected();
            
            // Toggle de selección: si está seleccionado, deseleccionar; si no, seleccionar
            oTable.setSelectedItem(oItem, !bSelected);
            
            // Actualizar el contador de selección y estado activo
            const aSelectedItems = oTable.getSelectedItems();
            const oModel = this.getView().getModel("promotionsModel");
            
            // Contar activas e inactivas
            let activeCount = 0;
            let inactiveCount = 0;
            
            aSelectedItems.forEach(oItem => {
                const oContext = oItem.getBindingContext("promotionsModel");
                const oPromotion = oContext.getObject();
                if (oPromotion.ACTIVED === true && oPromotion.DELETED !== true) {
                    activeCount++;
                } else {
                    inactiveCount++;
                }
            });
            
            // Determinar el estado: true si hay activas, false si solo inactivas, null si mixtas
            let hasActiveSelected;
            if (activeCount > 0 && inactiveCount === 0) {
                hasActiveSelected = true; // Solo activas
            } else if (inactiveCount > 0 && activeCount === 0) {
                hasActiveSelected = false; // Solo inactivas
            } else if (activeCount > 0 && inactiveCount > 0) {
                hasActiveSelected = null; // Mixtas
            } else {
                hasActiveSelected = false; // Default
            }
            
            oModel.setProperty("/selectedCount", aSelectedItems.length);
            oModel.setProperty("/hasActiveSelected", hasActiveSelected);
        },

        onNewPromotion: function () {
            // Navegar a la vista de creación de promociones (CrearPromocion)
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCrearPromocion");
        },

        onEditPromotion: async function () {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona una promoción para editar.");
                return;
            }
            
            if (aSelectedItems.length > 1) {
                // Edición masiva
                const oModel = this.getView().getModel("promotionsModel");
                const selectedIds = aSelectedItems.map(function (item) {
                    const ctx = item.getBindingContext("promotionsModel");
                    const obj = ctx.getObject();
                    return obj.IdPromoOK;
                }).filter(Boolean);

                await this._openBulkEditDialog(selectedIds);
                return;
            }

            // Edición individual
            const oContext = aSelectedItems[0].getBindingContext("promotionsModel");
            const oPromotion = oContext.getObject();
            await this._openEditDialog(oPromotion);
        },

        _openEditDialog: async function(oPromotion) {
            const oView = this.getView();
            
            if (!this._editDialog) {
                this._editDialog = await Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.EditPromoDialog",
                    controller: this
                });
                oView.addDependent(this._editDialog);
            }
            
            // Preparar datos para el modelo de edición
            const editData = {
                IdPromoOK: oPromotion.IdPromoOK,
                Titulo: oPromotion.Titulo || '',
                Descripcion: oPromotion.Descripcion || '',
                FechaIni: oPromotion.FechaIni ? this._formatDateForInput(oPromotion.FechaIni) : '',
                FechaFin: oPromotion.FechaFin ? this._formatDateForInput(oPromotion.FechaFin) : '',
                TipoDescuento: oPromotion.TipoDescuento || 'PORCENTAJE',
                DescuentoPorcentaje: oPromotion.DescuentoPorcentaje || oPromotion['Descuento%'] || 0,
                DescuentoMonto: oPromotion.DescuentoMonto || 0,
                ACTIVED: oPromotion.ACTIVED !== false,
                DELETED: oPromotion.DELETED || false,
                REGUSER: oPromotion.REGUSER || '',
                REGDATE: oPromotion.REGDATE || '',
                ProductosAplicables: this._extractPresentacionesFromPromotion(oPromotion),
                originalProductosAplicables: this._extractPresentacionesFromPromotion(oPromotion),
                groupedProducts: [],
                selectedProductsCount: 0,
                saving: false,
                errorMessage: ''
            };
            
            // Agrupar productos
            editData.groupedProducts = this._groupProductsBySkuid(editData.ProductosAplicables);
            editData.paginatedGroupedProducts = [];
            editData.currentPage = 1;
            editData.itemsPerPage = 5;
            editData.totalPages = Math.ceil(editData.groupedProducts.length / 5);
            
            const oEditModel = this.getView().getModel("editPromoModel");
            oEditModel.setData(editData);
            
            // Actualizar productos paginados
            this._updateEditPaginatedProducts();
            
            this._editDialog.open();
        },

        _formatDateForInput: function(sDate) {
            if (!sDate) return '';
            try {
                const oDate = new Date(sDate);
                const year = oDate.getFullYear();
                const month = String(oDate.getMonth() + 1).padStart(2, '0');
                const day = String(oDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (e) {
                return '';
            }
        },

        _extractPresentacionesFromPromotion: function(oPromotion) {
            if (!oPromotion) return [];
            
            if (Array.isArray(oPromotion.ProductosAplicables)) {
                const result = oPromotion.ProductosAplicables.filter(function(p) {
                    return p && p.IdPresentaOK;
                }).map(function(p) {
                    return {
                        IdPresentaOK: p.IdPresentaOK,
                        SKUID: p.SKUID,
                        NOMBREPRESENTACION: p.NombrePresentacion || p.NOMBREPRESENTACION || '',
                        Precio: p.PrecioOriginal || p.Precio || 0,
                        NombreProducto: p.NombreProducto || '',
                        selected: false
                    };
                });
                                return result;
            }
            return [];
        },

        _groupProductsBySkuid: function(aPresentaciones) {
            const productMap = new Map();
            
            aPresentaciones.forEach(function(presentacion) {
                const skuid = presentacion.SKUID;
                if (!productMap.has(skuid)) {
                    productMap.set(skuid, {
                        SKUID: skuid,
                        PRODUCTNAME: presentacion.NombreProducto || 'Sin nombre',
                        presentaciones: [],
                        expanded: false,
                        selected: false,
                        allSelected: false
                    });
                }
                productMap.get(skuid).presentaciones.push(presentacion);
            });
            
            const result = Array.from(productMap.values());
            
            // Actualizar allSelected para cada producto
            result.forEach(function(product) {
                const totalPresentaciones = product.presentaciones.length;
                const selectedPresentaciones = product.presentaciones.filter(p => p.selected).length;
                product.allSelected = totalPresentaciones > 0 && selectedPresentaciones === totalPresentaciones;
            });
            
                        return result;
        },

        onEditProductCheckBoxSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("editPromoModel");
            const sPath = oContext.getPath();
            const oEditModel = this.getView().getModel("editPromoModel");
            const aPresentaciones = oEditModel.getProperty(sPath + "/presentaciones");
            
            // Seleccionar/deseleccionar todas las presentaciones del producto
            aPresentaciones.forEach(function(pres, index) {
                oEditModel.setProperty(sPath + "/presentaciones/" + index + "/selected", bSelected);
            });
            
            oEditModel.setProperty(sPath + "/allSelected", bSelected);
            
            // Actualizar contador global
            this._updateSelectedProductsCount();
        },

        onEditPresentacionSelect: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("editPromoModel");
            const sPath = oContext.getPath();
            
            // Extraer el índice del producto desde el path
            // Ejemplo: "/paginatedGroupedProducts/0/presentaciones/1" o "/groupedProducts/0/presentaciones/1"
            const aPathParts = sPath.split("/");
            const isPaginated = aPathParts[1] === "paginatedGroupedProducts";
            const productIndex = parseInt(aPathParts[2]);
            
            const oEditModel = this.getView().getModel("editPromoModel");
            const basePath = isPaginated ? "/paginatedGroupedProducts/" : "/groupedProducts/";
            const oProduct = oEditModel.getProperty(basePath + productIndex);
            
            // Verificar si todas las presentaciones están seleccionadas
            const totalPresentaciones = oProduct.presentaciones.length;
            const selectedPresentaciones = oProduct.presentaciones.filter(p => p.selected).length;
            const bAllSelected = selectedPresentaciones === totalPresentaciones;
            
            oEditModel.setProperty(basePath + productIndex + "/allSelected", bAllSelected);
            
            // Actualizar contador global
            this._updateSelectedProductsCount();
        },
        
        _updateSelectedProductsCount: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const aAllGroupedProducts = oEditModel.getProperty("/groupedProducts") || [];
            
            let totalSelected = 0;
            aAllGroupedProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected === true) {
                            totalSelected++;
                        }
                    });
                }
            });
            
            oEditModel.setProperty("/selectedProductsCount", totalSelected);
        },

        onEditTabSelect: function(oEvent) {
            const sKey = oEvent.getParameter("key");
        },

        onEditActivedChange: function(oEvent) {
            const bState = oEvent.getParameter("state");
            const oEditModel = this.getView().getModel("editPromoModel");
            oEditModel.setProperty("/ACTIVED", bState);
        },

        onEditTipoDescuentoChange: function(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oEditModel = this.getView().getModel("editPromoModel");
            oEditModel.setProperty("/TipoDescuento", sKey);
        },

        onEditSelectAllProducts: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const aGrouped = oEditModel.getProperty("/groupedProducts");
            const currentCount = oEditModel.getProperty("/selectedProductsCount");
            const totalPresentaciones = oEditModel.getProperty("/ProductosAplicables/length");
            
            const bSelectAll = currentCount < totalPresentaciones;
            
            aGrouped.forEach(function(product, productIndex) {
                product.allSelected = bSelectAll;
                product.presentaciones.forEach(function(pres, presIndex) {
                    pres.selected = bSelectAll;
                    oEditModel.setProperty("/groupedProducts/" + productIndex + "/presentaciones/" + presIndex + "/selected", bSelectAll);
                });
                oEditModel.setProperty("/groupedProducts/" + productIndex + "/allSelected", bSelectAll);
            });
            
            oEditModel.setProperty("/groupedProducts", aGrouped);
            this._updateEditPaginatedProducts();
            this._updateSelectedProductsCount();
        },

        onEditProductsSelectionChange: function(oEvent) {
            const oList = oEvent.getSource();
            const aSelectedItems = oList.getSelectedItems();
            const oEditModel = this.getView().getModel("editPromoModel");
            
            let count = 0;
            aSelectedItems.forEach(function(oItem) {
                const oContext = oItem.getBindingContext("editPromoModel");
                const oProduct = oContext.getObject();
                count += oProduct.presentaciones.length;
            });
            
            oEditModel.setProperty("/selectedProductsCount", count);
        },

        onEditRemoveSelectedProducts: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const aGroupedProducts = oEditModel.getProperty("/paginatedGroupedProducts") || [];
            const aAllGroupedProducts = oEditModel.getProperty("/groupedProducts") || [];
            
            // Recolectar presentaciones seleccionadas de TODOS los productos (no solo los paginados)
            const selectedPresentaciones = [];
            aAllGroupedProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected === true) {
                            selectedPresentaciones.push(pres.IdPresentaOK);
                        }
                    });
                }
            });
            
            if (selectedPresentaciones.length === 0) {
                MessageBox.warning("No hay productos seleccionados para eliminar.");
                return;
            }
            
            const that = this;
            MessageBox.confirm(
                `¿Estás seguro de eliminar ${selectedPresentaciones.length} presentación(es) de la promoción?`,
                {
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            // Filtrar ProductosAplicables para remover las presentaciones seleccionadas
                            const aProductos = oEditModel.getProperty("/ProductosAplicables");
                            const aFiltered = aProductos.filter(function(p) {
                                return !selectedPresentaciones.includes(p.IdPresentaOK);
                            });
                            
                            oEditModel.setProperty("/ProductosAplicables", aFiltered);
                            oEditModel.setProperty("/groupedProducts", that._groupProductsBySkuid(aFiltered));
                            oEditModel.setProperty("/selectedProductsCount", 0);
                            oEditModel.setProperty("/currentPage", 1);
                            that._updateEditPaginatedProducts();
                            
                            MessageToast.show(`${selectedPresentaciones.length} presentación(es) eliminada(s)`);
                        }
                    }
                }
            );
        },

        onEditSearchProducts: function(oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oEditModel = this.getView().getModel("editPromoModel");
            const aProductos = oEditModel.getProperty("/ProductosAplicables");
            
            if (!sQuery || sQuery.trim() === "") {
                oEditModel.setProperty("/groupedProducts", this._groupProductsBySkuid(aProductos));
                return;
            }
            
            const sQueryLower = sQuery.toLowerCase();
            const aFiltered = aProductos.filter(function(p) {
                return (p.NombreProducto && p.NombreProducto.toLowerCase().includes(sQueryLower)) ||
                       (p.SKUID && p.SKUID.toLowerCase().includes(sQueryLower)) ||
                       (p.NOMBREPRESENTACION && p.NOMBREPRESENTACION.toLowerCase().includes(sQueryLower));
            });
            
            oEditModel.setProperty("/groupedProducts", this._groupProductsBySkuid(aFiltered));
            oEditModel.setProperty("/currentPage", 1);
            this._updateEditPaginatedProducts();
        },

        _updateEditPaginatedProducts: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const aAllProducts = oEditModel.getProperty("/groupedProducts") || [];
            const currentPage = oEditModel.getProperty("/currentPage") || 1;
            const itemsPerPage = oEditModel.getProperty("/itemsPerPage") || 5;
            
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const aPaginated = aAllProducts.slice(startIndex, endIndex);
            
            oEditModel.setProperty("/paginatedGroupedProducts", aPaginated);
            oEditModel.setProperty("/totalPages", Math.ceil(aAllProducts.length / itemsPerPage));
        },

        onEditPreviousPage: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const currentPage = oEditModel.getProperty("/currentPage");
            if (currentPage > 1) {
                oEditModel.setProperty("/currentPage", currentPage - 1);
                this._updateEditPaginatedProducts();
            }
        },

        onEditNextPage: function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const currentPage = oEditModel.getProperty("/currentPage");
            const totalPages = oEditModel.getProperty("/totalPages");
            if (currentPage < totalPages) {
                oEditModel.setProperty("/currentPage", currentPage + 1);
                this._updateEditPaginatedProducts();
            }
        },

        onEditItemsPerPageChange: function(oEvent) {
            const oEditModel = this.getView().getModel("editPromoModel");
            const sKey = oEvent.getParameter("selectedItem").getKey();
            oEditModel.setProperty("/itemsPerPage", parseInt(sKey));
            oEditModel.setProperty("/currentPage", 1);
            this._updateEditPaginatedProducts();
        },

        onEditToggleProductExpansion: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("editPromoModel");
            const sPath = oContext.getPath();
            const oEditModel = this.getView().getModel("editPromoModel");
            const bExpanded = oEditModel.getProperty(sPath + "/expanded");
            
            oEditModel.setProperty(sPath + "/expanded", !bExpanded);
        },

        onEditOpenAddProducts: async function() {
            const oView = this.getView();
            const oFilterModel = this.getView().getModel("filterModel");
            const oEditModel = this.getView().getModel("editPromoModel");
            
            // Crear el di�logo si no existe
            if (!this._addProductsDialog) {
                const oFragment = await Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.AdvancedFilters",
                    controller: this
                });
                
                let oFilterContent = Array.isArray(oFragment) ? oFragment[0] : oFragment;
                
                this._addProductsDialog = new sap.m.Dialog({
                    title: "Agregar Productos",
                    contentWidth: "90%",
                    contentHeight: "80%",
                    resizable: true,
                    draggable: true,
                    content: [oFilterContent],
                    beginButton: new sap.m.Button({
                        text: "Guardar",
                        type: sap.m.ButtonType.Emphasized,
                        press: this.onEditAddSelectedProducts.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancelar",
                        press: function() { this._addProductsDialog.close(); }.bind(this)
                    })
                });
                
                oView.addDependent(this._addProductsDialog);
            }
            
            // Obtener presentaciones ya seleccionadas en la promoci�n
            const aProductosAplicables = oEditModel.getProperty("/ProductosAplicables") || [];
            const oAlreadyInPromotion = {};
            
            aProductosAplicables.forEach(p => {
                if (p.IdPresentaOK) {
                    oAlreadyInPromotion[p.IdPresentaOK] = true;
                }
            });
            
            // Resetear modelo de filtros
            oFilterModel.setProperty("/alreadyInPromotion", oAlreadyInPromotion);
            oFilterModel.setProperty("/selectedPresentaciones", {});
            oFilterModel.setProperty("/addedPresentaciones", {});
            oFilterModel.setProperty("/hasTemporarySelections", false);
            oFilterModel.setProperty("/isManagingSelection", false);
            // NO resetear allPresentacionesLoaded - mantener el cache de presentaciones
            oFilterModel.setProperty("/showOnlyAdded", false);
            oFilterModel.setProperty("/searchTerm", "");
            oFilterModel.setProperty("/filters/category", []);
            oFilterModel.setProperty("/filters/brand", []);
            oFilterModel.setProperty("/filters/minPrice", null);
            oFilterModel.setProperty("/filters/maxPrice", null);
            oFilterModel.setProperty("/filters/startDate", null);
            oFilterModel.setProperty("/filters/endDate", null);
            oFilterModel.setProperty("/pagination/currentPage", 1);
            
            // Abrir el di�logo
            this._addProductsDialog.open();
            
            // Cargar productos si no hay datos
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            if (aAllProducts.length === 0) {
                oFilterModel.setProperty("/loading", true);
                this._loadProductsForDialog();
            } else {
                this._applyProductFilters();
            }
        },
        
        _loadProductsForDialog: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            // Si ya están cargados, no recargar
            const allProducts = oFilterModel.getProperty("/allProducts");
            if (allProducts && allProducts.length > 0) {
                return;
            }
            
            // Evitar llamadas simultáneas
            if (this._isLoadingDialogProducts) {
                return;
            }
            
            this._isLoadingDialogProducts = true;
            oFilterModel.setProperty("/loading", true);
            
            try {
                // Cargar productos usando _callApi
                const productData = await this._callApi('/ztproducts/crudProducts', 'POST', {}, {
                    ProcessType: 'GetAll'
                });
                
                let aProducts = [];
                
                if (productData?.data?.[0]?.dataRes) {
                    aProducts = productData.data[0].dataRes;
                } else if (productData?.value?.[0]?.data?.[0]?.dataRes) {
                    aProducts = productData.value[0].data[0].dataRes;
                } else if (Array.isArray(productData?.data)) {
                    aProducts = productData.data;
                } else if (Array.isArray(productData)) {
                    aProducts = productData;
                }
                
                // Filtrar solo activos
                aProducts = aProducts.filter(p => p.ACTIVED && !p.DELETED);
                
                // Cargar categor�as usando _callApi
                const categoryData = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
                let aCategories = [];
                
                if (categoryData?.data?.[0]?.dataRes) {
                    aCategories = categoryData.data[0].dataRes;
                } else if (categoryData?.value?.[0]?.data?.[0]?.dataRes) {
                    aCategories = categoryData.value[0].data[0].dataRes;
                } else if (Array.isArray(categoryData?.data)) {
                    aCategories = categoryData.data;
                }
                
                // Extraer marcas �nicas
                const marcasSet = new Set();
                aProducts.forEach(p => {
                    if (p.MARCA) marcasSet.add(p.MARCA);
                });
                const aBrands = Array.from(marcasSet).map(marca => ({
                    id: marca,
                    name: marca
                }));
                
                oFilterModel.setProperty("/allProducts", aProducts);
                oFilterModel.setProperty("/categories", aCategories);
                oFilterModel.setProperty("/brands", aBrands);
                oFilterModel.setProperty("/productPresentaciones", {});
                
                                                
                // Aplicar filtros para mostrar productos (manteniendo loading activo)
                setTimeout(async () => {
                    await this._applyProductFilters();
                    oFilterModel.setProperty("/loading", false);
                }, 100);
                
            } catch (error) {
                console.error("Error cargando productos:", error);
                MessageToast.show("Error al cargar productos: " + error.message);
                oFilterModel.setProperty("/loading", false);
            } finally {
                this._isLoadingDialogProducts = false;
            }
        },

        onEditSavePromotion: async function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const oData = oEditModel.getData();
            
            // Validaciones
            if (!oData.Titulo || oData.Titulo.trim() === "") {
                oEditModel.setProperty("/errorMessage", "El título es obligatorio");
                return;
            }
            
            if (!oData.FechaIni || !oData.FechaFin) {
                oEditModel.setProperty("/errorMessage", "Las fechas de inicio y fin son obligatorias");
                return;
            }
            
            if (new Date(oData.FechaFin) <= new Date(oData.FechaIni)) {
                oEditModel.setProperty("/errorMessage", "La fecha de fin debe ser posterior a la fecha de inicio");
                return;
            }
            
            if (!oData.ProductosAplicables || oData.ProductosAplicables.length === 0) {
                oEditModel.setProperty("/errorMessage", "Debe seleccionar al menos una presentación para la promoción");
                return;
            }
            
            if (oData.TipoDescuento === 'PORCENTAJE') {
                if (!oData.DescuentoPorcentaje || oData.DescuentoPorcentaje <= 0 || oData.DescuentoPorcentaje > 100) {
                    oEditModel.setProperty("/errorMessage", "El porcentaje de descuento debe estar entre 1 y 100");
                    return;
                }
            } else if (oData.TipoDescuento === 'MONTO_FIJO') {
                if (!oData.DescuentoMonto || oData.DescuentoMonto <= 0) {
                    oEditModel.setProperty("/errorMessage", "El monto de descuento debe ser mayor a 0");
                    return;
                }
            }
            
            oEditModel.setProperty("/saving", true);
            oEditModel.setProperty("/errorMessage", "");
            
            try {
                const presentacionesAplicables = oData.ProductosAplicables.map(function(p) {
                    return {
                        IdPresentaOK: p.IdPresentaOK,
                        SKUID: p.SKUID,
                        NombreProducto: p.NombreProducto || '',
                        NombrePresentacion: p.NOMBREPRESENTACION || '',
                        PrecioOriginal: p.Precio || 0
                    };
                });
                
                const updateData = {
                    Titulo: oData.Titulo,
                    Descripcion: oData.Descripcion,
                    FechaIni: new Date(oData.FechaIni).toISOString(),
                    FechaFin: new Date(oData.FechaFin).toISOString(),
                    TipoDescuento: oData.TipoDescuento,
                    ProductosAplicables: presentacionesAplicables,
                    ACTIVED: oData.ACTIVED,
                    DELETED: oData.ACTIVED ? false : oData.DELETED  // Si se activa, asegurar que no esté eliminada
                };
                
                if (oData.TipoDescuento === 'PORCENTAJE' && oData.DescuentoPorcentaje > 0) {
                    updateData.DescuentoPorcentaje = oData.DescuentoPorcentaje;
                    updateData.DescuentoMonto = 0;
                } else if (oData.TipoDescuento === 'MONTO_FIJO' && oData.DescuentoMonto > 0) {
                    updateData.DescuentoMonto = oData.DescuentoMonto;
                    updateData.DescuentoPorcentaje = 0;
                }
                
                await this._callApi('/ztpromociones/crudPromociones', 'POST', updateData, {
                    ProcessType: 'UpdateOne',
                    IdPromoOK: oData.IdPromoOK,
                    DBServer: 'MongoDB'
                });
                
                MessageToast.show("Promoción actualizada correctamente");
                this._editDialog.close();
                this.forceReloadPromotions();
                
            } catch (error) {
                console.error("Error al guardar:", error);
                oEditModel.setProperty("/errorMessage", error.message || "Error al guardar la promoción");
            } finally {
                oEditModel.setProperty("/saving", false);
            }
        },

        onEditDeleteHard: async function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const oData = oEditModel.getData();
            
            const that = this;
            MessageBox.confirm(
                `⚠️ ADVERTENCIA: ¿Estás seguro de que quieres eliminar PERMANENTEMENTE la promoción "${oData.Titulo}"? Esta acción NO se puede deshacer.`,
                {
                    title: "Confirmación de Eliminación Permanente",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: async function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            oEditModel.setProperty("/saving", true);
                            try {
                                await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                    ProcessType: 'DeleteHard',
                                    IdPromoOK: oData.IdPromoOK,
                                    DBServer: 'MongoDB'
                                });
                                
                                MessageToast.show("Promoción eliminada permanentemente");
                                that._editDialog.close();
                                that.loadPromotions();
                            } catch (error) {
                                console.error("Error al eliminar:", error);
                                oEditModel.setProperty("/errorMessage", error.message || "Error al eliminar la promoción");
                            } finally {
                                oEditModel.setProperty("/saving", false);
                            }
                        }
                    }
                }
            );
        },

        onEditToggleActive: async function() {
            const oEditModel = this.getView().getModel("editPromoModel");
            const oData = oEditModel.getData();
            const bCurrentlyActive = oData.ACTIVED;
            
            const that = this;
            const sMessage = bCurrentlyActive 
                ? `¿Estás seguro de que quieres desactivar la promoción "${oData.Titulo}"?`
                : `¿Estás seguro de que quieres activar la promoción "${oData.Titulo}"?`;
            
            MessageBox.confirm(sMessage, {
                onClose: async function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        oEditModel.setProperty("/saving", true);
                        try {
                            const processType = bCurrentlyActive ? 'DeleteLogic' : 'ActivateOne';
                            
                            await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                ProcessType: processType,
                                IdPromoOK: oData.IdPromoOK,
                                DBServer: 'MongoDB'
                            });
                            
                            const sSuccessMessage = bCurrentlyActive ? "Promoción desactivada" : "Promoción activada";
                            MessageToast.show(sSuccessMessage);
                            that._editDialog.close();
                            that.loadPromotions();
                        } catch (error) {
                            console.error("Error al cambiar estado:", error);
                            oEditModel.setProperty("/errorMessage", error.message || "Error al cambiar el estado");
                        } finally {
                            oEditModel.setProperty("/saving", false);
                        }
                    }
                }
            });
        },

        onEditCloseDialog: function() {
            this._editDialog.close();
        },

        // ========== FIN MÉTODOS DE EDICIÓN ==========

        // ========== INICIO EDICIÓN MASIVA ==========
        _openBulkEditDialog: async function(selectedIds) {
            const oView = this.getView();
            if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
                MessageBox.warning("Selecciona al menos una promoción para editar.");
                return;
            }

            if (!this._bulkEditDialog) {
                this._bulkEditDialog = await Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.BulkEditDialog",
                    controller: this
                });
                oView.addDependent(this._bulkEditDialog);
            }

            const oBulkModel = this.getView().getModel("bulkEditModel");
            oBulkModel.setData({
                selectedIds: selectedIds,
                saving: false,
                errorMessage: "",
                fields: {
                    updateTitulo: false, Titulo: "",
                    updateDescripcion: false, Descripcion: "",
                    updateFechaIni: false, FechaIni: "",
                    updateFechaFin: false, FechaFin: "",
                    updateTipoDescuento: false, TipoDescuento: "PORCENTAJE",
                    updateDescuentoPorcentaje: false, DescuentoPorcentaje: 0,
                    updateDescuentoMonto: false, DescuentoMonto: 0,
                    updateActived: false, ACTIVED: true
                }
            });

            this._bulkEditDialog.open();
        },

        onBulkTipoDescuentoChange: function(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oBulkModel = this.getView().getModel("bulkEditModel");
            oBulkModel.setProperty("/fields/TipoDescuento", sKey);
        },

        onBulkSavePromotions: async function() {
            const oBulkModel = this.getView().getModel("bulkEditModel");
            const oData = oBulkModel.getData();
            const aIds = oData.selectedIds || [];
            const f = oData.fields || {};

            // Validar que haya al menos un campo a actualizar
            if (!f.updateTitulo && !f.updateDescripcion && !f.updateFechaIni && !f.updateFechaFin &&
                !f.updateTipoDescuento && !f.updateDescuentoPorcentaje && !f.updateDescuentoMonto && !f.updateActived) {
                oBulkModel.setProperty("/errorMessage", "Selecciona al menos un campo para actualizar");
                return;
            }

            // Validaciones de consistencia
            if ((f.updateFechaIni && !f.FechaIni) || (f.updateFechaFin && !f.FechaFin)) {
                oBulkModel.setProperty("/errorMessage", "Si actualizas fechas, ambas deben tener valor");
                return;
            }
            if (f.updateFechaIni && f.updateFechaFin) {
                if (new Date(f.FechaFin) <= new Date(f.FechaIni)) {
                    oBulkModel.setProperty("/errorMessage", "La fecha de fin debe ser posterior a la de inicio");
                    return;
                }
            }

            if (f.updateTipoDescuento) {
                if (f.TipoDescuento === "PORCENTAJE") {
                    if (!f.updateDescuentoPorcentaje || f.DescuentoPorcentaje <= 0 || f.DescuentoPorcentaje > 100) {
                        oBulkModel.setProperty("/errorMessage", "Define un porcentaje entre 1 y 100");
                        return;
                    }
                } else if (f.TipoDescuento === "MONTO_FIJO") {
                    if (!f.updateDescuentoMonto || f.DescuentoMonto <= 0) {
                        oBulkModel.setProperty("/errorMessage", "Define un monto de descuento válido (> 0)");
                        return;
                    }
                }
            } else {
                // Si no cambia tipo, pero se intenta cambiar valores, validar también
                if (f.updateDescuentoPorcentaje) {
                    if (f.DescuentoPorcentaje <= 0 || f.DescuentoPorcentaje > 100) {
                        oBulkModel.setProperty("/errorMessage", "El porcentaje debe estar entre 1 y 100");
                        return;
                    }
                }
                if (f.updateDescuentoMonto) {
                    if (f.DescuentoMonto <= 0) {
                        oBulkModel.setProperty("/errorMessage", "El monto de descuento debe ser > 0");
                        return;
                    }
                }
            }

            oBulkModel.setProperty("/saving", true);
            oBulkModel.setProperty("/errorMessage", "");

            try {
                const oPromModel = this.getView().getModel("promotionsModel");
                const aAll = oPromModel.getProperty("/promotions") || [];

                // Map rápido por IdPromoOK
                const mapById = new Map(aAll.map(p => [p.IdPromoOK, p]));

                let successCount = 0;
                for (const id of aIds) {
                    const promo = mapById.get(id);
                    if (!promo) continue;

                    // Construir payload tomando valores actuales como base
                    const updateData = {
                        Titulo: promo.Titulo || '',
                        Descripcion: promo.Descripcion || '',
                        FechaIni: promo.FechaIni ? new Date(promo.FechaIni).toISOString() : new Date().toISOString(),
                        FechaFin: promo.FechaFin ? new Date(promo.FechaFin).toISOString() : new Date().toISOString(),
                        TipoDescuento: promo.TipoDescuento || 'PORCENTAJE',
                        DescuentoPorcentaje: promo.DescuentoPorcentaje || promo["Descuento%"] || 0,
                        DescuentoMonto: promo.DescuentoMonto || 0,
                        ACTIVED: promo.ACTIVED !== false,
                        ProductosAplicables: Array.isArray(promo.ProductosAplicables) ? promo.ProductosAplicables.map(function(p){
                            return {
                                IdPresentaOK: p.IdPresentaOK,
                                SKUID: p.SKUID,
                                NombreProducto: p.NombreProducto || '',
                                NombrePresentacion: p.NombrePresentacion || p.NOMBREPRESENTACION || '',
                                PrecioOriginal: p.PrecioOriginal || p.Precio || 0
                            };
                        }) : []
                    };

                    // Aplicar overrides seleccionados
                    if (f.updateTitulo) updateData.Titulo = f.Titulo;
                    if (f.updateDescripcion) updateData.Descripcion = f.Descripcion;
                    if (f.updateFechaIni) updateData.FechaIni = new Date(f.FechaIni).toISOString();
                    if (f.updateFechaFin) updateData.FechaFin = new Date(f.FechaFin).toISOString();
                    if (f.updateTipoDescuento) updateData.TipoDescuento = f.TipoDescuento;
                    if (f.updateDescuentoPorcentaje) {
                        updateData.DescuentoPorcentaje = f.DescuentoPorcentaje;
                        updateData.DescuentoMonto = 0;
                    }
                    if (f.updateDescuentoMonto) {
                        updateData.DescuentoMonto = f.DescuentoMonto;
                        updateData.DescuentoPorcentaje = 0;
                    }
                    if (f.updateActived) updateData.ACTIVED = !!f.ACTIVED;

                    try {
                        await this._callApi('/ztpromociones/crudPromociones', 'POST', updateData, {
                            ProcessType: 'UpdateOne',
                            IdPromoOK: id,
                            DBServer: 'MongoDB'
                        });
                        successCount++;
                    } catch (e) {
                        // Continuar con el siguiente, acumulando errores en consola
                        console.error('Fallo al actualizar promoción', id, e);
                    }
                }

                MessageToast.show(`${successCount} promoción(es) actualizada(s)`);
                this._bulkEditDialog.close();
                this.loadPromotions();
            } catch (error) {
                console.error("Error en guardado masivo:", error);
                oBulkModel.setProperty("/errorMessage", error.message || "Error al guardar cambios");
            } finally {
                oBulkModel.setProperty("/saving", false);
            }
        },

        onBulkCloseDialog: function() {
            this._bulkEditDialog.close();
        },
        // ========== FIN EDICIÓN MASIVA ==========

        onDeletePromotion: async function () {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción para eliminar.");
                return;
            }
            
            const that = this;
            MessageBox.confirm(
                `¿Estás seguro de que quieres eliminar ${aSelectedItems.length} promoción(es)? Esta acción NO se puede deshacer.`,
                {
                    title: "Confirmar Eliminación",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: async function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            try {
                                // Obtener todos los IDs de promociones seleccionadas
                                const aIdsToDelete = aSelectedItems.map(oItem => {
                                    const oContext = oItem.getBindingContext("promotionsModel");
                                    return oContext.getObject().IdPromoOK;
                                });
                                
                                // Usar endpoint unificado que acepta uno o varios IDs
                                await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                    ProcessType: 'DeleteHard',
                                    IdPromoOK: aIdsToDelete,
                                    DBServer: 'MongoDB'
                                });
                                
                                // Actualizar el modelo localmente sin recargar
                                const oModel = that.getView().getModel("promotionsModel");
                                let aPromotions = oModel.getProperty("/promotions");
                                
                                // Filtrar las promociones eliminadas
                                aPromotions = aPromotions.filter(promo => !aIdsToDelete.includes(promo.IdPromoOK));
                                
                                oModel.setProperty("/promotions", aPromotions);
                                oModel.setProperty("/totalPromotions", aPromotions.length);
                                oModel.refresh(true);
                                
                                MessageToast.show(`${aIdsToDelete.length} promoción(es) eliminada(s) correctamente`);
                                oTable.removeSelections();
                                
                            } catch (error) {
                                MessageBox.error("Error al eliminar promociones: " + error.message);
                            }
                        }
                    }
                }
            );
        },

        onDeactivatePromotion: async function () {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción para desactivar.");
                return;
            }
            
            const that = this;
            try {
                // Obtener todos los IDs de promociones seleccionadas
                const aIdsToDeactivate = aSelectedItems.map(oItem => {
                    const oContext = oItem.getBindingContext("promotionsModel");
                    return oContext.getObject().IdPromoOK;
                });
                
                // Usar endpoint unificado que acepta uno o varios IDs
                await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                    ProcessType: 'DeleteLogic',
                    IdPromoOK: aIdsToDeactivate,
                    DBServer: 'MongoDB'
                });
                
                // Actualizar el modelo localmente sin recargar
                const oModel = that.getView().getModel("promotionsModel");
                const aPromotions = oModel.getProperty("/promotions");
                
                aPromotions.forEach(promo => {
                    if (aIdsToDeactivate.includes(promo.IdPromoOK)) {
                        promo.ACTIVED = false;
                        promo.DELETED = true;
                    }
                });
                
                oModel.setProperty("/promotions", aPromotions);
                oModel.refresh(true);
                
                MessageToast.show(`${aSelectedItems.length} promoción(es) desactivada(s) correctamente`);
                oTable.removeSelections();
                
            } catch (error) {
                MessageBox.error("Error al desactivar promociones: " + error.message);
            }
        },

        onSearch: function (oEvent) {
            this._applyFilters();
        },

        onStatusFilterChange: function(oEvent) {
            this._applyFilters();
        },

        _applyFilters: function() {
            const oModel = this.getView().getModel("promotionsModel");
            const sSearchQuery = oModel.getProperty("/searchText") || "";
            const sStatusFilter = oModel.getProperty("/statusFilter") || "all";
            const oTable = this.byId("promotionsTable");
            const oBinding = oTable.getBinding("items");
            
            const aFilters = [];
            
            // Filtro de búsqueda
            if (sSearchQuery && sSearchQuery.length > 0) {
                const aSearchFilters = [
                    new Filter("Titulo", FilterOperator.Contains, sSearchQuery),
                    new Filter("Descripcion", FilterOperator.Contains, sSearchQuery),
                    new Filter("IdPromoOK", FilterOperator.Contains, sSearchQuery)
                ];
                aFilters.push(new Filter({
                    filters: aSearchFilters,
                    and: false
                }));
            }
            
            // Filtro de estado
            if (sStatusFilter && sStatusFilter !== "all") {
                aFilters.push(new Filter({
                    path: "",
                    test: (oPromotion) => {
                        return this.getPromotionStatus(oPromotion) === sStatusFilter;
                    }
                }));
            }
            
            oBinding.filter(aFilters);
        },

        onToggleActivationBulk: async function() {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción.");
                return;
            }
            
            // Separar IDs por estado actual (activas vs inactivas)
            const aIdsToActivate = [];
            const aIdsToDeactivate = [];
            
            aSelectedItems.forEach(oItem => {
                const oContext = oItem.getBindingContext("promotionsModel");
                const oPromotion = oContext.getObject();
                
                if (oPromotion.ACTIVED === true && oPromotion.DELETED !== true) {
                    // Está activa, se desactivará
                    aIdsToDeactivate.push(oPromotion.IdPromoOK);
                } else {
                    // Está inactiva, se activará
                    aIdsToActivate.push(oPromotion.IdPromoOK);
                }
            });
            
            if (aIdsToActivate.length === 0 && aIdsToDeactivate.length === 0) {
                MessageToast.show("No hay promociones para procesar");
                return;
            }
            
            // Construir mensaje dinámico
            let sMessage = "¿Deseas cambiar el estado de las promociones seleccionadas?\n\n";
            if (aIdsToActivate.length > 0) {
                sMessage += `Activar: ${aIdsToActivate.length} promoción(es)\n`;
            }
            if (aIdsToDeactivate.length > 0) {
                sMessage += `Desactivar: ${aIdsToDeactivate.length} promoción(es)`;
            }
            
            MessageBox.confirm(sMessage, {
                title: "Confirmar cambio de estado",
                onClose: async (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        try {
                            let totalProcessed = 0;
                            
                            // Activar las que están inactivas
                            if (aIdsToActivate.length > 0) {
                                await this._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                    ProcessType: 'ActivateOne',
                                    IdPromoOK: aIdsToActivate,
                                    DBServer: 'MongoDB'
                                });
                                totalProcessed += aIdsToActivate.length;
                            }
                            
                            // Desactivar las que están activas
                            if (aIdsToDeactivate.length > 0) {
                                await this._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                    ProcessType: 'DeleteLogic',
                                    IdPromoOK: aIdsToDeactivate,
                                    DBServer: 'MongoDB'
                                });
                                totalProcessed += aIdsToDeactivate.length;
                            }
                            
                            // Actualizar el modelo localmente sin recargar
                            const oModel = this.getView().getModel("promotionsModel");
                            const aPromotions = oModel.getProperty("/promotions");
                            
                            aPromotions.forEach(promo => {
                                if (aIdsToActivate.includes(promo.IdPromoOK)) {
                                    promo.ACTIVED = true;
                                    promo.DELETED = false;
                                } else if (aIdsToDeactivate.includes(promo.IdPromoOK)) {
                                    promo.ACTIVED = false;
                                    promo.DELETED = true;
                                }
                            });
                            
                            oModel.setProperty("/promotions", aPromotions);
                            oModel.refresh(true);
                            
                            MessageToast.show(`${totalProcessed} promoción(es) actualizadas correctamente`);
                            oTable.removeSelections();
                            
                        } catch (error) {
                            console.error("Error al cambiar estado:", error);
                            MessageBox.error("Error al cambiar el estado de las promociones: " + error.message);
                        }
                    }
                }
            });
        },

        onPromotionPress: function (oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("promotionsModel");
            const oPromotion = oContext.getObject();
            this._openEditDialog(oPromotion);
        },

        onCancelAddProducts: function() {
            this._addProductsDialog.close();
        },

        onConfirmAddProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oEditModel = this.getView().getModel("editPromoModel");
            const aPaginatedProducts = oFilterModel.getProperty("/paginatedProducts") || [];
            let aNewPresentaciones = [];
            
            aPaginatedProducts.forEach(product => {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(pres => {
                        if (pres.selected && !pres.locked) {
                            aNewPresentaciones.push({
                                IdPresentaOK: pres.IdPresentaOK,
                                SKUID: product.SKUID,
                                NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                                Precio: pres.precio,
                                NombreProducto: product.PRODUCTNAME
                            });
                        }
                    });
                }
            });
            
            const aProductos = oEditModel.getProperty("/ProductosAplicables") || [];
            const aCombined = [...aProductos, ...aNewPresentaciones];
            oEditModel.setProperty("/ProductosAplicables", aCombined);
            oEditModel.setProperty("/groupedProducts", this._groupProductsBySkuid(aCombined));
            this._updateEditPaginatedProducts();
            
            MessageToast.show(`${aNewPresentaciones.length} presentación(es) agregada(s) a la promoción`);
            this._addProductsDialog.close();
        },

        // ================================================================================
        // 6. BUSINESS LOGIC - FILTERS & DATA PROCESSING
        // ================================================================================
        
        onFilterSearch: function(oEvent) {
            const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", sValue);
            this._applyProductFilters();
        },

        onCategoryChange: function() {
            this._applyProductFilters();
        },

        onBrandChange: function() {
            this._applyProductFilters();
        },

        onPriceChange: function() {
            this._applyProductFilters();
        },

        onDateChange: function() {
            this._applyProductFilters();
        },

        onPriceShortcut: function(oEvent) {
            const sText = oEvent.getSource().getText();
            const oFilterModel = this.getView().getModel("filterModel");
            
            switch(sText) {
                case "$0-$50":
                    oFilterModel.setProperty("/filters/minPrice", 0);
                    oFilterModel.setProperty("/filters/maxPrice", 50);
                    break;
                case "$50-$100":
                    oFilterModel.setProperty("/filters/minPrice", 50);
                    oFilterModel.setProperty("/filters/maxPrice", 100);
                    break;
                case "$100-$200":
                    oFilterModel.setProperty("/filters/minPrice", 100);
                    oFilterModel.setProperty("/filters/maxPrice", 200);
                    break;
                case "$200+":
                    oFilterModel.setProperty("/filters/minPrice", 200);
                    oFilterModel.setProperty("/filters/maxPrice", null);
                    break;
            }
            
            this._applyProductFilters();
        },

        onDateShortcut: function(oEvent) {
            const oFilterModel = this.getView().getModel("filterModel");
            const sText = oEvent.getSource().getText();
            const today = new Date();
            let startDate, endDate;
            
            switch (sText) {
                case "Hoy":
                    startDate = new Date(today);
                    endDate = new Date(today);
                    break;
                case "Últimos 7 días":
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 7);
                    endDate = new Date(today);
                    break;
                case "Últimos 30 días":
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 30);
                    endDate = new Date(today);
                    break;
                case "Este mes":
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    endDate = new Date(today);
                    break;
            }
            
            // Format dates as YYYY-MM-DD for DatePicker
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            oFilterModel.setProperty("/filters/startDate", formatDate(startDate));
            oFilterModel.setProperty("/filters/endDate", formatDate(endDate));
            
            this._applyProductFilters();
        },

        onClearAllFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", "");
            oFilterModel.setProperty("/filters", {
                categorias: [],
                marcas: [],
                precioMin: '',
                precioMax: '',
                fechaIngresoDesde: '',
                fechaIngresoHasta: ''
            });
            this._applyProductFilters();
        },

        _applyProductFilters: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            const oFilters = oFilterModel.getProperty("/filters") || {};
            const sSearchTerm = oFilterModel.getProperty("/searchTerm") || '';
            const bShowOnlyAdded = oFilterModel.getProperty("/showOnlyAdded") || false;
            const sSortBy = oFilterModel.getProperty("/sortBy") || "default";
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};

            
            // Construir Set de productos agregados
            const addedProductsSet = new Set();
            Object.keys(oAddedPresentaciones).forEach(presId => {
                const oPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
                for (const skuid in oPresentaciones) {
                    const aPres = oPresentaciones[skuid] || [];
                    if (aPres.some(p => p.IdPresentaOK === presId)) {
                        addedProductsSet.add(skuid);
                    }
                }
            });

            let aFiltered = aAllProducts.filter(product => {
                if (!product.ACTIVED || product.DELETED) return false;

                // Filtro de solo agregados (solo agregados/seleccionados)
                if (bShowOnlyAdded) {
                    if (!addedProductsSet.has(product.SKUID)) return false;
                }

                if (sSearchTerm) {
                    const searchLower = sSearchTerm.toLowerCase();
                    const matchesSearch = 
                        (product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(searchLower)) ||
                        (product.SKUID && product.SKUID.toLowerCase().includes(searchLower)) ||
                        (product.MARCA && product.MARCA.toLowerCase().includes(searchLower));
                    if (!matchesSearch) return false;
                }

                if (oFilters.marcas && oFilters.marcas.length > 0) {
                    if (!oFilters.marcas.includes(product.MARCA)) return false;
                }

                if (oFilters.categorias && oFilters.categorias.length > 0) {
                    if (product.CATEGORIAS && Array.isArray(product.CATEGORIAS)) {
                        const hasCategory = product.CATEGORIAS.some(cat => oFilters.categorias.includes(cat));
                        if (!hasCategory) return false;
                    } else {
                        return false;
                    }
                }

                if (oFilters.precioMin && product.PRECIO < parseFloat(oFilters.precioMin)) return false;
                if (oFilters.precioMax && product.PRECIO > parseFloat(oFilters.precioMax)) return false;

                if (oFilters.fechaIngresoDesde) {
                    const fechaDesde = new Date(oFilters.fechaIngresoDesde);
                    const fechaProducto = new Date(product.REGDATE);
                    if (fechaProducto < fechaDesde) return false;
                }
                if (oFilters.fechaIngresoHasta) {
                    const fechaHasta = new Date(oFilters.fechaIngresoHasta);
                    const fechaProducto = new Date(product.REGDATE);
                    if (fechaProducto > fechaHasta) return false;
                }

                return true;
            });

            // Aplicar ordenamiento
            switch (sSortBy) {
                case "addedFirst":
                    aFiltered.sort((a, b) => {
                        const aIsAdded = addedProductsSet.has(a.SKUID);
                        const bIsAdded = addedProductsSet.has(b.SKUID);
                        if (aIsAdded && !bIsAdded) return -1;
                        if (!aIsAdded && bIsAdded) return 1;
                        return 0;
                    });
                    break;
                case "notAddedFirst":
                    aFiltered.sort((a, b) => {
                        const aIsAdded = addedProductsSet.has(a.SKUID);
                        const bIsAdded = addedProductsSet.has(b.SKUID);
                        if (!aIsAdded && bIsAdded) return -1;
                        if (aIsAdded && !bIsAdded) return 1;
                        return 0;
                    });
                    break;
                case "nameAsc":
                    aFiltered.sort((a, b) => (a.PRODUCTNAME || "").localeCompare(b.PRODUCTNAME || ""));
                    break;
                case "nameDesc":
                    aFiltered.sort((a, b) => (b.PRODUCTNAME || "").localeCompare(a.PRODUCTNAME || ""));
                    break;
                case "default":
                default:
                    break;
            }

            // Si "Solo agregados" est� activado, filtrar productos con presentaciones pre-agregadas
            if (bShowOnlyAdded) {
                const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
                const addedSKUIDs = new Set();
                
                // Obtener todos los SKUIDs que tienen presentaciones pre-agregadas
                Object.values(oaddedPresentaciones).forEach(pres => {
                    if (pres.SKUID) {
                        addedSKUIDs.add(pres.SKUID);
                    }
                });
                
                aFiltered = aFiltered.filter(p => addedSKUIDs.has(p.SKUID));
            }

            let activeCount = 0;
            if (oFilters.categorias && oFilters.categorias.length > 0) activeCount++;
            if (oFilters.marcas && oFilters.marcas.length > 0) activeCount++;
            if (oFilters.precioMin || oFilters.precioMax) activeCount++;
            if (oFilters.fechaIngresoDesde || oFilters.fechaIngresoHasta) activeCount++;
            if (sSearchTerm) activeCount++;

            oFilterModel.setProperty("/activeFiltersCount", activeCount);
            oFilterModel.setProperty("/filteredProducts", aFiltered);
            oFilterModel.setProperty("/filteredProductsCount", aFiltered.length);
            oFilterModel.setProperty("/pagination/currentPage", 1);

            
            await this._updateFilterPagination();
        },

        _updateFilterPagination: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            const aFiltered = oFilterModel.getProperty("/filteredProducts") || [];
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage") || 1;
            const iPageSize = 10;

            const iTotal = aFiltered.length;
            const iTotalPages = Math.ceil(iTotal / iPageSize);
            const iStartIndex = (iCurrentPage - 1) * iPageSize;
            const iEndIndex = Math.min(iStartIndex + iPageSize, iTotal);

            let aPaginated = aFiltered.slice(iStartIndex, iEndIndex);

            
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            
            // Cargar TODAS las presentaciones en una sola llamada si no están cargadas
            const allPresentacionesLoaded = oFilterModel.getProperty("/allPresentacionesLoaded");
            
            if (!allPresentacionesLoaded) {
                await this._loadAllPresentaciones();
            }

            const updatedPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const oAlreadyInPromotion = oFilterModel.getProperty("/alreadyInPromotion") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            // Guardar el estado expanded actual de los productos (por defecto todos colapsados)
            const currentPaginatedProducts = oFilterModel.getProperty("/paginatedProducts") || [];
            const expandedState = {};
            currentPaginatedProducts.forEach(p => {
                if (p.SKUID) {
                    // Solo preservar si está explícitamente expandido
                    expandedState[p.SKUID] = p.expanded === true;
                }
            });
            
            aPaginated = aPaginated.map(product => {
                const aPresentaciones = (updatedPresentaciones[product.SKUID] || []).map(pres => {
                    const isAdded = !!oAddedPresentaciones[pres.IdPresentaOK];
                    const isSelected = !!oSelectedPresentaciones[pres.IdPresentaOK];
                    const isInPromotion = !!oAlreadyInPromotion[pres.IdPresentaOK];
                    
                    return {
                        ...pres,
                        // Las que ya est�n en promoci�n siempre aparecen seleccionadas
                        selected: isInPromotion || isAdded || isSelected,
                        added: isAdded,
                        // Bloquear si est� agregada (y no en modo gesti�n) O si ya est� en la promoci�n
                        locked: isInPromotion || (isAdded && !bIsManaging),
                        alreadyInPromotion: isInPromotion
                    };
                });
                
                // Calcular allSelected basado en presentaciones seleccionadas/pre-agregadas
                const selectablePresentaciones = aPresentaciones.filter(p => !p.alreadyInPromotion && (!p.locked || bIsManaging)).length;
                const selectedPresentaciones = aPresentaciones.filter(p => p.selected && !p.alreadyInPromotion).length;
                
                // Bloquear producto si TODAS sus presentaciones est�n bloqueadas
                const totalPresentaciones = aPresentaciones.length;
                const lockedPresentaciones = aPresentaciones.filter(p => p.locked).length;
                const productLocked = totalPresentaciones > 0 && lockedPresentaciones === totalPresentaciones;
                
                // Marcar producto como allSelected si TODAS sus presentaciones est�n seleccionadas (incluyendo las de BD)
                const allPresentacionesSelected = totalPresentaciones > 0 && aPresentaciones.every(p => p.selected);
                
                // Preservar el estado expanded si existe, si no, mantener colapsado por defecto (false)
                const isExpanded = expandedState[product.SKUID] === true ? true : false;
                
                    // Nueva propiedad: �alguna presentacion ya est� en la promoci�n?
                    const alreadyInPromotionProduct = aPresentaciones.some(p => p.alreadyInPromotion);
                    
                    // Nueva propiedad: �tiene presentaciones agregadas? (solo las que NO est�n ya en la promoci�n)
                    const hasAddedPresentations = aPresentaciones.some(p => p.added && !p.alreadyInPromotion);

                    return {
                        ...product,
                        PRODUCTNAME: product.PRODUCTNAME || product.Nombre || 'Sin nombre',
                        presentaciones: aPresentaciones,
                        presentacionesCount: aPresentaciones.length,
                        expanded: isExpanded,
                        allSelected: allPresentacionesSelected,
                        locked: productLocked,  // Producto bloqueado si todas sus presentaciones están bloqueadas
                        alreadyInPromotionProduct: alreadyInPromotionProduct,
                        hasAddedPresentations: hasAddedPresentations
                    };
            });

            oFilterModel.setProperty("/paginatedProducts", aPaginated);
            oFilterModel.setProperty("/pagination", {
                currentPage: iCurrentPage,
                totalPages: iTotalPages,
                total: iTotal,
                startItem: iTotal === 0 ? 0 : iStartIndex + 1,
                endItem: iEndIndex,
                hasNext: iCurrentPage < iTotalPages,
                hasPrev: iCurrentPage > 1
            });

                    },

        _loadAllPresentaciones: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            try {
                // Cargar TODAS las presentaciones en una sola llamada
                const oResponse = await this._callApi(
                    '/ztproducts-presentaciones/productsPresentacionesCRUD',
                    'POST',
                    {},
                    {
                        ProcessType: 'GetAll'
                    }
                );
                
                let aPresentaciones = [];
                
                // Extraer presentaciones de la respuesta
                if (Array.isArray(oResponse)) {
                    aPresentaciones = oResponse;
                } else if (oResponse?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.data[0].dataRes;
                } else if (oResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.value[0].data[0].dataRes;
                } else if (Array.isArray(oResponse?.data)) {
                    aPresentaciones = oResponse.data;
                }
                
                // Filtrar solo presentaciones activas
                aPresentaciones = aPresentaciones.filter(p => p && p.ACTIVED && !p.DELETED);
                
                // Agrupar presentaciones por SKUID
                const oProductPresentaciones = {};
                aPresentaciones.forEach(pres => {
                    const skuid = pres.SKUID;
                    if (!oProductPresentaciones[skuid]) {
                        oProductPresentaciones[skuid] = [];
                    }
                    oProductPresentaciones[skuid].push(pres);
                });
                
                // Guardar en el modelo
                oFilterModel.setProperty("/productPresentaciones", oProductPresentaciones);
                oFilterModel.setProperty("/allPresentacionesLoaded", true);
                
            } catch (error) {
                console.error("Error cargando todas las presentaciones:", error);
                MessageToast.show("Error al cargar presentaciones: " + error.message);
            }
        },

        _loadPresentaciones: async function(sSKUID) {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return [];
            
            // Verificar si ya está en caché
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            if (oProductPresentaciones[sSKUID]) {
                return oProductPresentaciones[sSKUID];
            }
            
            try {
                                
                // Usar el MISMO endpoint que SelectPresentationtoEditPage.controller.js
                const oResponse = await this._callApi(
                    '/ztproducts-presentaciones/productsPresentacionesCRUD',
                    'POST',
                    {},
                    {
                        ProcessType: 'GetBySKUID',
                        skuid: sSKUID
                    }
                );
                
                let aPresentaciones = [];
                
                // Extraer presentaciones de la respuesta
                if (Array.isArray(oResponse)) {
                    // Respuesta directa como array
                    aPresentaciones = oResponse;
                } else if (oResponse?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.data[0].dataRes;
                } else if (oResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.value[0].data[0].dataRes;
                } else if (Array.isArray(oResponse?.data)) {
                    aPresentaciones = oResponse.data;
                }
                
                // Filtrar solo presentaciones activas
                aPresentaciones = aPresentaciones.filter(p => p && p.ACTIVED && !p.DELETED);
                
                                if (aPresentaciones.length > 0) {
                                    }
                
                // Guardar en cache
                oProductPresentaciones[sSKUID] = aPresentaciones;
                oFilterModel.setProperty("/productPresentaciones", oProductPresentaciones);
                
                return aPresentaciones;

            } catch (error) {
                console.error(`? Error cargando presentaciones para ${sSKUID}:`, error);
                
                // En caso de error, guardar array vac�o en cache
                oProductPresentaciones[sSKUID] = [];
                oFilterModel.setProperty("/productPresentaciones", oProductPresentaciones);
                
                return [];
            }
        },

        onSelectAllProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aFiltered = oFilterModel.getProperty("/filteredProducts") || [];
            const oSelected = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const oAlreadyInPromotion = oFilterModel.getProperty("/alreadyInPromotion") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            
            let count = 0;
            
            if (bIsManaging) {
                // Volver a marcar todas las presentaciones visibles como pre-agregadas
                aFiltered.forEach((product) => {
                    const aPresentaciones = oProductPresentaciones[product.SKUID];
                    if (aPresentaciones && Array.isArray(aPresentaciones)) {
                        aPresentaciones.forEach((pres) => {
                            const isInPromotion = !!oAlreadyInPromotion[pres.IdPresentaOK];
                            
                            if (!isInPromotion) {
                                oaddedPresentaciones[pres.IdPresentaOK] = pres;
                                pres.selected = true;
                                pres.added = true;
                                pres.locked = true;
                                count++;
                            }
                        });
                    }
                });
                
                oFilterModel.setProperty("/addedPresentaciones", oaddedPresentaciones);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oaddedPresentaciones).length > 0);
                
                // Refrescar la paginaci�n para actualizar la vista
                this._updateFilterPagination();
                
                MessageToast.show(`${count} presentaci�n(es) pre-agregada(s) en todas las p�ginas`);
                return;
            }
            
            // Modo normal: seleccionar todas las presentaciones disponibles
            aFiltered.forEach((product) => {
                const aPresentaciones = oProductPresentaciones[product.SKUID];
                if (aPresentaciones && Array.isArray(aPresentaciones)) {
                    aPresentaciones.forEach((pres) => {
                        const isadded = !!oaddedPresentaciones[pres.IdPresentaOK];
                        const isInPromotion = !!oAlreadyInPromotion[pres.IdPresentaOK];
                        const isLocked = isadded && !bIsManaging;
                        
                        if (!isLocked && !isInPromotion) {
                            oSelected[pres.IdPresentaOK] = pres;
                            pres.selected = true;
                            count++;
                        }
                    });
                }
            });
            
            oFilterModel.setProperty("/selectedPresentaciones", oSelected);
            oFilterModel.setProperty("/selectedPresentacionesCount", Object.keys(oSelected).length);
            oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oSelected).length > 0);
            
            // Refrescar la paginaci�n para actualizar la vista
            this._updateFilterPagination();
            
            MessageToast.show(`${count} presentacion(es) seleccionada(s) en todas las p�ginas`);
        },

        onDeselectAllProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aFiltered = oFilterModel.getProperty("/filteredProducts") || [];
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            
            let count = 0;
            
            if (bIsManaging) {
                // Modo gesti�n: eliminar todas las presentaciones pre-agregadas
                aFiltered.forEach((product) => {
                    const aPresentaciones = oProductPresentaciones[product.SKUID];
                    if (aPresentaciones && Array.isArray(aPresentaciones)) {
                        aPresentaciones.forEach((pres) => {
                            if (oaddedPresentaciones[pres.IdPresentaOK]) {
                                delete oaddedPresentaciones[pres.IdPresentaOK];
                                pres.selected = false;
                                pres.added = false;
                                pres.locked = false;
                                count++;
                            }
                        });
                    }
                });
                
                oFilterModel.setProperty("/addedPresentaciones", oaddedPresentaciones);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oaddedPresentaciones).length > 0);
                
                // Si no quedan pre-agregadas, desactivar el filtro "Solo agregados"
                if (Object.keys(oaddedPresentaciones).length === 0) {
                    oFilterModel.setProperty("/showOnlyAdded", false);
                }
                
                // Refrescar la paginaci�n para actualizar la vista
                this._updateFilterPagination();
                
                MessageToast.show(`${count} presentaci�n(es) pre-agregada(s) eliminada(s) de todas las p�ginas`);
            } else {
                // Modo normal: limpiar selecciones temporales
                aFiltered.forEach((product) => {
                    const aPresentaciones = oProductPresentaciones[product.SKUID];
                    if (aPresentaciones && Array.isArray(aPresentaciones)) {
                        aPresentaciones.forEach((pres) => {
                            const isadded = !!oaddedPresentaciones[pres.IdPresentaOK];
                            const isLocked = isadded && !bIsManaging;
                            
                            // Solo desmarcar si no est� bloqueada y est� en selecciones temporales
                            if (!isLocked && oSelectedPresentaciones[pres.IdPresentaOK]) {
                                delete oSelectedPresentaciones[pres.IdPresentaOK];
                                pres.selected = false;
                                count++;
                            }
                        });
                    }
                });
                
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                oFilterModel.setProperty("/selectedPresentacionesCount", Object.keys(oSelectedPresentaciones).length);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oSelectedPresentaciones).length > 0);
                
                // Refrescar la paginaci�n para actualizar la vista
                this._updateFilterPagination();
                
                MessageToast.show(`${count} selecci�n(es) temporal(es) limpiada(s) de todas las p�ginas`);
            }
        },

        onProductSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const aPresentaciones = oFilterModel.getProperty(sPath + "/presentaciones") || [];
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const oAlreadyInPromotion = oFilterModel.getProperty("/alreadyInPromotion") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            let selectionChanged = false;
            let addedChanged = false;
            
            // Marcar/desmarcar solo las presentaciones que no est�n bloqueadas
            aPresentaciones.forEach((pres, index) => {
                const isadded = !!oaddedPresentaciones[pres.IdPresentaOK];
                const isInPromotion = !!oAlreadyInPromotion[pres.IdPresentaOK];
                const isLocked = isadded && !bIsManaging;
                
                // Si est� en modo gestionar
                if (bIsManaging) {
                    if (!isInPromotion) {
                        if (bSelected) {
                            // Seleccionar: agregar a addedPresentaciones
                            oaddedPresentaciones[pres.IdPresentaOK] = pres;
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", true);
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/added", true);
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/locked", true);
                            addedChanged = true;
                        } else {
                            // Deseleccionar: eliminar de addedPresentaciones
                            delete oaddedPresentaciones[pres.IdPresentaOK];
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", false);
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/added", false);
                            oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/locked", false);
                            addedChanged = true;
                        }
                    }
                }
                // Modo normal: Solo modificar si no est� bloqueada y no est� ya en la promoci�n
                else if (!isLocked && !isInPromotion) {
                    oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", bSelected);
                    
                    if (bSelected) {
                        oSelectedPresentaciones[pres.IdPresentaOK] = pres;
                        selectionChanged = true;
                    } else {
                        delete oSelectedPresentaciones[pres.IdPresentaOK];
                        selectionChanged = true;
                    }
                }
            });
            
            if (selectionChanged) {
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                
                // Actualizar flag para mostrar bot�n Agregar
                const hasSelections = Object.keys(oSelectedPresentaciones).length > 0;
                oFilterModel.setProperty("/hasTemporarySelections", hasSelections);
            }
            
            if (addedChanged) {
                oFilterModel.setProperty("/addedPresentaciones", oaddedPresentaciones);
                
                // Actualizar hasTemporarySelections si ya no hay pre-agregadas
                const bHasadded = Object.keys(oaddedPresentaciones).length > 0;
                if (!bHasadded) {
                    oFilterModel.setProperty("/hasTemporarySelections", false);
                }
            }
            
            // Actualizar el estado del checkbox del producto bas�ndose en presentaciones no bloqueadas
            const selectablePresentaciones = aPresentaciones.filter(p => {
                const isadded = !!oaddedPresentaciones[p.IdPresentaOK];
                const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                const isLocked = isadded && !bIsManaging;
                return !isLocked && !isInPromotion;
            }).length;
            
            const selectedPresentaciones = aPresentaciones.filter(p => {
                const isadded = !!oaddedPresentaciones[p.IdPresentaOK];
                const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                const isLocked = isadded && !bIsManaging;
                return p.selected && !isLocked && !isInPromotion;
            }).length;
            
            const bAllSelected = selectablePresentaciones > 0 && selectedPresentaciones === selectablePresentaciones;
            oFilterModel.setProperty(sPath + "/allSelected", bAllSelected);
            
            // Actualizar hasAddedPresentations para el producto (solo si hay cambios en agregados)
            if (addedChanged) {
                const hasAddedPresentations = aPresentaciones.some(p => {
                    const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                    return !!oaddedPresentaciones[p.IdPresentaOK] && !isInPromotion;
                });
                oFilterModel.setProperty(sPath + "/hasAddedPresentations", hasAddedPresentations);
                this._updateFilterPagination();
            }
        },
        
        onPreAddSelections: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (Object.keys(oSelectedPresentaciones).length === 0) {
                MessageToast.show("No hay presentaciones seleccionadas para agregar.");
                return;
            }
            
            // Mover selecciones temporales a agregadas
            let count = 0;
            Object.keys(oSelectedPresentaciones).forEach(presId => {
                oaddedPresentaciones[presId] = oSelectedPresentaciones[presId];
                count++;
            });
            
            oFilterModel.setProperty("/addedPresentaciones", oaddedPresentaciones);
            oFilterModel.setProperty("/selectedPresentaciones", {});
            oFilterModel.setProperty("/hasTemporarySelections", false);
            
            MessageToast.show(`${count} presentación(es) agregada(s). Estas ahora están bloqueadas.`);
            
            // Refrescar para aplicar locked y actualizar indicadores "Agregado"
            this._updateFilterPagination();
        },
        
        onPresentacionSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const oAlreadyInPromotion = oFilterModel.getProperty("/alreadyInPromotion") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            const oPresentacion = oContext.getObject();
            const isInPromotion = !!oAlreadyInPromotion[oPresentacion.IdPresentaOK];
            
            // 1. Si ya est� en la promoci�n guardada, no se puede modificar
            if (isInPromotion) {
                if (!bSelected) {
                    oFilterModel.setProperty(sPath + "/selected", true);
                    MessageToast.show("No puedes quitar presentaciones que ya est�n guardadas en la promoci�n.");
                }
                return;
            }
            
            // 2. Modo gesti�n: trabajar con addedPresentaciones
            if (bIsManaging) {
                if (bSelected) {
                    // Agregar a agregados
                    oaddedPresentaciones[oPresentacion.IdPresentaOK] = oPresentacion;
                    oFilterModel.setProperty(sPath + "/added", true);
                    oFilterModel.setProperty(sPath + "/locked", false);
                } else {
                    // Remover de agregados
                    delete oaddedPresentaciones[oPresentacion.IdPresentaOK];
                    oFilterModel.setProperty(sPath + "/added", false);
                    oFilterModel.setProperty(sPath + "/locked", false);
                }
                oFilterModel.setProperty("/addedPresentaciones", oaddedPresentaciones);
            }
            // 3. Modo normal: solo permitir selecci�n temporal si no est� pre-agregada
            else {
                const isadded = !!oaddedPresentaciones[oPresentacion.IdPresentaOK];
                
                if (isadded) {
                    // No permitir deseleccionar presentaciones pre-agregadas
                    if (!bSelected) {
                        oFilterModel.setProperty(sPath + "/selected", true);
                        MessageToast.show("Esta presentaci�n est� pre-agregada. Usa el modo Gesti�n para quitarla.");
                    }
                    return;
                }
                
                // Selecci�n temporal normal
                if (bSelected) {
                    oSelectedPresentaciones[oPresentacion.IdPresentaOK] = oPresentacion;
                } else {
                    delete oSelectedPresentaciones[oPresentacion.IdPresentaOK];
                }
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oSelectedPresentaciones).length > 0);
            }
            
            // Actualizar el estado del checkbox del producto
            const productPath = sPath.substring(0, sPath.lastIndexOf("/presentaciones"));
            const oProduct = oFilterModel.getProperty(productPath);
            
            if (oProduct && oProduct.presentaciones) {
                // Calcular allSelected considerando presentaciones no bloqueadas y no en promoci�n
                const selectablePresentaciones = oProduct.presentaciones.filter(p => {
                    const isadded = !!oaddedPresentaciones[p.IdPresentaOK];
                    const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                    const isLocked = isadded && !bIsManaging;
                    return !isLocked && !isInPromotion;
                }).length;
                
                const selectedPresentaciones = oProduct.presentaciones.filter(p => {
                    const isadded = !!oaddedPresentaciones[p.IdPresentaOK];
                    const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                    const isLocked = isadded && !bIsManaging;
                    return p.selected && !isLocked && !isInPromotion;
                }).length;
                
                const bAllSelected = selectablePresentaciones > 0 && selectedPresentaciones === selectablePresentaciones;
                oFilterModel.setProperty(productPath + "/allSelected", bAllSelected);
                
                // Recalcular si el producto debe estar bloqueado
                const totalPresentaciones = oProduct.presentaciones.length;
                const lockedPresentaciones = oProduct.presentaciones.filter(p => {
                    const isadded = !!oaddedPresentaciones[p.IdPresentaOK];
                    return isadded && !bIsManaging;
                }).length;
                const productLocked = totalPresentaciones > 0 && lockedPresentaciones === totalPresentaciones;
                oFilterModel.setProperty(productPath + "/locked", productLocked);
                
                // Actualizar hasAddedPresentations para el producto SOLO en modo gestión
                if (bIsManaging) {
                    const hasAddedPresentations = oProduct.presentaciones.some(p => {
                        const isInPromotion = !!oAlreadyInPromotion[p.IdPresentaOK];
                        return !!oaddedPresentaciones[p.IdPresentaOK] && !isInPromotion;
                    });
                    oFilterModel.setProperty(productPath + "/hasAddedPresentations", hasAddedPresentations);
                }
            }
            
            // Refrescar para actualizar estados visuales solo en modo gestión
            if (bIsManaging) {
                this._updateFilterPagination();
            }
        },
        
        onToggleProduct: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const bExpanded = oFilterModel.getProperty(sPath + "/expanded");
            
            oFilterModel.setProperty(sPath + "/expanded", !bExpanded);
        },

        onPreviousPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage");
            if (iCurrentPage > 1) {
                oFilterModel.setProperty("/pagination/currentPage", iCurrentPage - 1);
                this._updateFilterPagination();
            }
        },

        onNextPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage");
            const iTotalPages = oFilterModel.getProperty("/pagination/totalPages");
            if (iCurrentPage < iTotalPages) {
                oFilterModel.setProperty("/pagination/currentPage", iCurrentPage + 1);
                this._updateFilterPagination();
            }
        },

        onEditAddSelectedProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oEditModel = this.getView().getModel("editPromoModel");
            const oaddedPres = oFilterModel.getProperty("/addedPresentaciones") || {};
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            
            if (Object.keys(oaddedPres).length === 0) {
                MessageToast.show("No hay presentaciones pre-agregadas. Selecciona y pre-agrega algunas primero.");
                return;
            }
            
            let aNewPresentaciones = [];
            
            // Buscar las presentaciones pre-agregadas en todos los productos
            Object.keys(oaddedPres).forEach(presId => {
                // Buscar en productPresentaciones
                for (const skuid in oProductPresentaciones) {
                    const aPresentaciones = oProductPresentaciones[skuid] || [];
                    const pres = aPresentaciones.find(p => p.IdPresentaOK === presId);
                    if (pres) {
                        const product = aAllProducts.find(p => p.SKUID === skuid);
                        aNewPresentaciones.push({
                            IdPresentaOK: pres.IdPresentaOK,
                            SKUID: skuid,
                            NOMBREPRESENTACION: pres.NOMBREPRESENTACION || pres.Nombre || '',
                            Precio: pres.Precio || 0,
                            NombreProducto: product?.PRODUCTNAME || '',
                            selected: false
                        });
                        break;
                    }
                }
            });
            
            if (aNewPresentaciones.length === 0) {
                MessageToast.show("No hay presentaciones seleccionadas");
                return;
            }
            
            const aCurrentPresentaciones = oEditModel.getProperty("/ProductosAplicables") || [];
            const aCombined = [...aCurrentPresentaciones, ...aNewPresentaciones];
            oEditModel.setProperty("/ProductosAplicables", aCombined);
            oEditModel.setProperty("/groupedProducts", this._groupProductsBySkuid(aCombined));
            this._updateEditPaginatedProducts();
            
            MessageToast.show(`${aNewPresentaciones.length} presentacion(es) agregada(s)`);
            this._addProductsDialog.close();
        },
        
        onSortChange: function(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/sortBy", sKey);
            this._applyProductFilters();
        },
        
        onShowOnlyAddedChange: function(oEvent) {
            const bState = oEvent.getParameter("state");
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/showOnlyAdded", bState);
            this._applyProductFilters();
        },
        
        onToggleManageSelection: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            const oaddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (!bIsManaging) {
                // Verificar que haya pre-agregadas
                if (Object.keys(oaddedPresentaciones).length === 0) {
                    MessageToast.show("No hay presentaciones pre-agregadas para gestionar.");
                    return;
                }
                // Entrar en modo gesti�n - activar "Solo agregados" y deshabilitar el switch
                oFilterModel.setProperty("/showOnlyAdded", true);
                MessageToast.show("Modo Gesti�n activado. Ahora puedes deseleccionar presentaciones pre-agregadas.");
            } else {
                // Salir de modo gesti�n - addedPresentaciones ya fue modificado en onPresentacionSelect
                // Solo necesitamos actualizar hasTemporarySelections con el estado actual
                const oCurrentadded = oFilterModel.getProperty("/addedPresentaciones") || {};
                const bHasTemp = Object.keys(oCurrentadded).length > 0;
                oFilterModel.setProperty("/hasTemporarySelections", bHasTemp);
                
                oFilterModel.setProperty("/showOnlyAdded", false);
                
                const removedCount = Object.keys(oaddedPresentaciones).length - Object.keys(oCurrentadded).length;
                if (removedCount > 0) {
                    MessageToast.show(`Modo Gesti�n desactivado. Se eliminaron ${removedCount} presentaci�n(es).`);
                } else {
                    MessageToast.show("Modo Gesti�n desactivado.");
                }
            }
            
            oFilterModel.setProperty("/isManagingSelection", !bIsManaging);
            this._applyProductFilters();
        },
        
        onRemoveFilterChip: function(oEvent) {
            const oSource = oEvent.getSource();
            const sFilterKey = oSource.data("filterKey");
            const sFilterValue = oSource.data("filterValue");
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters") || {};
            
            if (sFilterKey === "categoria") {
                const aValues = oFilters.categorias || [];
                oFilters.categorias = aValues.filter(v => v !== sFilterValue);
                oFilterModel.setProperty("/filters", oFilters);
            } else if (sFilterKey === "marca") {
                const aValues = oFilters.marcas || [];
                oFilters.marcas = aValues.filter(v => v !== sFilterValue);
                oFilterModel.setProperty("/filters", oFilters);
            } else if (sFilterKey === "precio") {
                oFilters.precioMin = '';
                oFilters.precioMax = '';
                oFilterModel.setProperty("/filters", oFilters);
            } else if (sFilterKey === "fecha") {
                oFilters.fechaIngresoDesde = '';
                oFilters.fechaIngresoHasta = '';
                oFilterModel.setProperty("/filters", oFilters);
            } else if (sFilterKey === "busqueda") {
                oFilterModel.setProperty("/searchTerm", "");
            }
            
            this._applyProductFilters();
        },
        
        getActiveFiltersCount: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return 0;
            
            const oFilters = oFilterModel.getProperty("/filters") || {};
            const sSearchTerm = oFilterModel.getProperty("/searchTerm") || "";
            
            let count = 0;
            if (oFilters.categorias && oFilters.categorias.length > 0) count++;
            if (oFilters.marcas && oFilters.marcas.length > 0) count++;
            if (oFilters.precioMin || oFilters.precioMax) count++;
            if (oFilters.fechaIngresoDesde || oFilters.fechaIngresoHasta) count++;
            if (sSearchTerm) count++;
            
            return count;
        },

        // ========== FIN M�TODOS DEL FILTRO AVANZADO ==========


        onNavBack: function () {
                        const oHistory = sap.ui.core.routing.History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteMain", {}, true);
            }
        },

        onNavigateToCalendar: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCalendario");
        }
    });
});




