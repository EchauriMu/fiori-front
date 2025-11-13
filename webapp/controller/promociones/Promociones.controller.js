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

        onInit: function () {
            console.log("Iniciando Promociones Controller");
            
            // Modelo con datos para promociones
            var oModel = new JSONModel({
                promotions: [],
                totalPromotions: 0,
                activePromotions: 0,
                averageDiscount: 0,
                searchText: "",
                selectedCount: 0
            });
            
            this.getView().setModel(oModel, "promotionsModel");
            
            // Modelo para calendario
            const today = new Date();
            const oCalendarModel = new JSONModel({
                currentDate: today,
                currentMonthYear: this._getMonthYearText(today),
                viewMode: "month",
                filters: {
                    estado: "all",
                    search: ""
                },
                filteredPromotions: [],
                calendarDays: []
            });
            this.getView().setModel(oCalendarModel, "calendarModel");
            
            // Modelo para edición de promociones
            this.getView().setModel(new JSONModel({}), "editPromoModel");
            
            // Modelo para filtros de productos
            this.getView().setModel(new JSONModel({
                loading: false,
                errorMessage: '',
                searchTerm: '',
                filters: {
                    categorias: [],
                    marcas: [],
                    precioMin: '',
                    precioMax: '',
                    fechaIngresoDesde: '',
                    fechaIngresoHasta: ''
                },
                filtersExpanded: true,
                activeFiltersCount: 0,
                allProducts: [],
                allCategories: [],
                allBrands: [],
                filteredProducts: [],
                filteredProductsCount: 0,
                selectedPresentacionesCount: 0,
                lockedPresentaciones: []
            }), "filterModel");
            
            // Cargar datos automáticamente desde la API
            this.loadPromotions();

            // Conectar con el router
            this.getOwnerComponent().getRouter().getRoute("RoutePromociones")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            // Recargar promociones cada vez que se accede a la ruta
            this.loadPromotions();
        },

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

            const sQueryString = new URLSearchParams(oParams).toString();
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
            console.log("Cargando promociones desde la API...");
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
                
                console.log("Promociones cargadas:", aPromotions.length, aPromotions);
                
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
                
                // También actualizar el modelo del calendario
                this._updateCalendarPromotions(aPromotions);
                
                MessageToast.show(`${aPromotions.length} promociones cargadas desde el servidor`);
                
            } catch (error) {
                console.error("Error al cargar promociones:", error);
                MessageBox.error("Error al cargar promociones: " + error.message);
                
                // Establecer valores por defecto en caso de error
                oModel.setProperty("/promotions", []);
                oModel.setProperty("/totalPromotions", 0);
                oModel.setProperty("/activePromotions", 0);
                oModel.setProperty("/averageDiscount", 0);
            }
        },

        _isPromotionActive: function(oPromotion) {
            if (!oPromotion) return false;
            if (oPromotion.DELETED === true || oPromotion.ACTIVED === false) return false;
            
            const now = new Date();
            const startDate = new Date(oPromotion.FechaIni);
            const endDate = new Date(oPromotion.FechaFin);
            
            return now >= startDate && now <= endDate;
        },

        // Formatters
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

        // Event Handlers
        onTabSelect: function(oEvent) {
            const sKey = oEvent.getParameter("key");
            console.log("Tab seleccionado:", sKey);
            
            if (sKey === "calendar") {
                // Generar calendario cuando se selecciona la pestaña
                this._applyCalendarFilters();
                this._generateCalendarDays();
            }
        },

        // ========== MÉTODOS DEL CALENDARIO ==========
        
        _updateCalendarPromotions: function(aPromotions) {
            const oCalendarModel = this.getView().getModel("calendarModel");
            oCalendarModel.setProperty("/filteredPromotions", aPromotions);
            this._applyCalendarFilters();
        },

        _applyCalendarFilters: function() {
            const oModel = this.getView().getModel("promotionsModel");
            const oCalendarModel = this.getView().getModel("calendarModel");
            const aPromotions = oModel.getProperty("/promotions");
            const oFilters = oCalendarModel.getProperty("/filters");
            
            let aFiltered = aPromotions.filter(promo => {
                // Filtro por estado
                if (oFilters.estado !== "all") {
                    const status = this._getCalendarPromotionStatus(promo);
                    if (status !== oFilters.estado) return false;
                }
                
                // Filtro por búsqueda
                if (oFilters.search && oFilters.search.trim() !== "") {
                    const searchLower = oFilters.search.toLowerCase();
                    const matchesSearch = 
                        (promo.Titulo && promo.Titulo.toLowerCase().includes(searchLower)) ||
                        (promo.Descripcion && promo.Descripcion.toLowerCase().includes(searchLower)) ||
                        (promo.IdPromoOK && promo.IdPromoOK.toLowerCase().includes(searchLower));
                    
                    if (!matchesSearch) return false;
                }
                
                return true;
            });
            
            // Ordenar por fecha de inicio
            aFiltered.sort((a, b) => {
                const dateA = new Date(a.FechaIni).getTime();
                const dateB = new Date(b.FechaIni).getTime();
                return dateA - dateB;
            });
            
            oCalendarModel.setProperty("/filteredPromotions", aFiltered);
        },

        _getCalendarPromotionStatus: function(oPromotion) {
            if (!oPromotion) return "finished";
            
            if (oPromotion.DELETED === true || oPromotion.ACTIVED === false) {
                return "finished";
            }
            
            const today = new Date();
            const inicio = new Date(oPromotion.FechaIni);
            const fin = new Date(oPromotion.FechaFin);
            
            if (today < inicio) return "scheduled";
            if (today >= inicio && today <= fin) return "active";
            return "finished";
        },

        _generateCalendarDays: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const currentDate = oCalendarModel.getProperty("/currentDate");
            const aPromotions = oCalendarModel.getProperty("/filteredPromotions");
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            
            const firstDay = new Date(year, month, 1);
            
            // Empezar desde el domingo de la semana que contiene el primer día
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay());
            
            const aDays = [];
            const currentDay = new Date(startDate);
            
            // Generar 42 días (6 semanas)
            for (let i = 0; i < 42; i++) {
                const dayPromotions = aPromotions.filter(promo => {
                    if (!promo.FechaIni || !promo.FechaFin) return false;
                    
                    const inicio = new Date(promo.FechaIni);
                    const fin = new Date(promo.FechaFin);
                    
                    // Normalizar fechas para comparación (solo día)
                    const promoStart = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
                    const promoEnd = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
                    const checkDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                    
                    return checkDay >= promoStart && checkDay <= promoEnd;
                });
                
                aDays.push({
                    date: new Date(currentDay),
                    day: currentDay.getDate(),
                    isCurrentMonth: currentDay.getMonth() === month,
                    isToday: this._isToday(currentDay),
                    promotions: dayPromotions,
                    hasPromotions: dayPromotions.length > 0
                });
                
                currentDay.setDate(currentDay.getDate() + 1);
            }
            
            oCalendarModel.setProperty("/calendarDays", aDays);
            this._renderCalendarGrid();
        },

        _renderCalendarGrid: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const aDays = oCalendarModel.getProperty("/calendarDays");
            const oGrid = this.byId("promoCalendarGrid");
            
            if (!oGrid) return;
            
            oGrid.removeAllContent();
            
            const that = this;
            aDays.forEach(function(dayInfo) {
                const oVBox = new VBox({
                    alignItems: "Start",
                    justifyContent: "Start"
                }).addStyleClass("calendar-day-cell");
                
                if (!dayInfo.isCurrentMonth) {
                    oVBox.addStyleClass("other-month");
                }
                
                if (dayInfo.isToday) {
                    oVBox.addStyleClass("today");
                }
                
                // Número del día
                const oDayText = new Text({
                    text: dayInfo.day.toString()
                }).addStyleClass("calendar-day-number");
                
                oVBox.addItem(oDayText);
                
                // Promociones (máximo 3)
                if (dayInfo.promotions && dayInfo.promotions.length > 0) {
                    dayInfo.promotions.slice(0, 3).forEach(function(promo) {
                        const sIcon = that._getPromotionIcon(promo);
                        const status = that._getCalendarPromotionStatus(promo);
                        
                        const oPromoBox = new VBox({
                            items: [
                                new Text({
                                    text: sIcon + " " + (promo.Titulo || "").substring(0, 15) + (promo.Titulo && promo.Titulo.length > 15 ? "..." : ""),
                                    wrapping: false
                                }).addStyleClass("calendar-promo-text")
                            ]
                        }).addStyleClass("calendar-promo-item").addStyleClass("promo-" + status);
                        
                        oPromoBox.attachBrowserEvent("click", function() {
                            MessageToast.show(promo.Titulo);
                        });
                        
                        oVBox.addItem(oPromoBox);
                    });
                    
                    // Indicador de más promociones
                    if (dayInfo.promotions.length > 3) {
                        oVBox.addItem(new Text({
                            text: "+" + (dayInfo.promotions.length - 3) + " más"
                        }).addStyleClass("calendar-more-promos"));
                    }
                }
                
                oGrid.addContent(oVBox);
            });
        },

        _getPromotionIcon: function(oPromotion) {
            const status = this._getCalendarPromotionStatus(oPromotion);
            if (status === "active") return "●";
            if (status === "scheduled") return "○";
            return "◌";
        },

        _isToday: function(oDate) {
            const today = new Date();
            return oDate.getDate() === today.getDate() &&
                   oDate.getMonth() === today.getMonth() &&
                   oDate.getFullYear() === today.getFullYear();
        },

        _getMonthYearText: function(oDate) {
            const oDateFormat = DateFormat.getDateInstance({
                pattern: "MMMM yyyy"
            });
            return oDateFormat.format(oDate);
        },

        onCalendarFilterChange: function() {
            this._applyCalendarFilters();
            const oCalendarModel = this.getView().getModel("calendarModel");
            const sViewMode = oCalendarModel.getProperty("/viewMode");
            
            if (sViewMode === "month") {
                this._generateCalendarDays();
            }
        },

        onCalendarViewModeChange: function(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oCalendarModel = this.getView().getModel("calendarModel");
            oCalendarModel.setProperty("/viewMode", sKey);
            
            if (sKey === "month") {
                this._generateCalendarDays();
            }
        },

        onCalendarPreviousMonth: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const currentDate = oCalendarModel.getProperty("/currentDate");
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() - 1);
            
            oCalendarModel.setProperty("/currentDate", newDate);
            oCalendarModel.setProperty("/currentMonthYear", this._getMonthYearText(newDate));
            this._generateCalendarDays();
        },

        onCalendarNextMonth: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const currentDate = oCalendarModel.getProperty("/currentDate");
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() + 1);
            
            oCalendarModel.setProperty("/currentDate", newDate);
            oCalendarModel.setProperty("/currentMonthYear", this._getMonthYearText(newDate));
            this._generateCalendarDays();
        },

        onCalendarToday: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const today = new Date();
            
            oCalendarModel.setProperty("/currentDate", today);
            oCalendarModel.setProperty("/currentMonthYear", this._getMonthYearText(today));
            this._generateCalendarDays();
        },

        onCalendarPromotionPress: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("calendarModel");
            const oPromotion = oContext.getObject();
            
            MessageToast.show("Promoción: " + oPromotion.Titulo);
        },

        onCalendarExport: function() {
            const oCalendarModel = this.getView().getModel("calendarModel");
            const aPromotions = oCalendarModel.getProperty("/filteredPromotions");
            
            if (aPromotions.length === 0) {
                MessageBox.warning("No hay promociones para exportar");
                return;
            }
            
            // Preparar datos CSV
            const aHeaders = ['ID', 'Título', 'Descripción', 'Fecha Inicio', 'Fecha Fin', 'Descuento %', 'Estado', 'Creado Por'];
            const that = this;
            const aRows = aPromotions.map(function(promo) {
                return [
                    promo.IdPromoOK || '',
                    promo.Titulo || '',
                    promo.Descripcion || '',
                    that.formatDate(promo.FechaIni),
                    that.formatDate(promo.FechaFin),
                    promo.DescuentoPorcentaje || promo['Descuento%'] || '0',
                    that.getPromotionStatus(promo),
                    promo.REGUSER || ''
                ];
            });
            
            // Crear CSV
            const sCsvContent = [
                aHeaders.join(',')
            ].concat(
                aRows.map(function(row) {
                    return row.map(function(cell) {
                        return '"' + cell + '"';
                    }).join(',');
                })
            ).join('\n');
            
            // Descargar archivo
            const blob = new Blob(['\uFEFF' + sCsvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'promociones_' + new Date().toISOString().split('T')[0] + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            MessageToast.show(aPromotions.length + " promociones exportadas a CSV");
        },

        // ========== FIN MÉTODOS DEL CALENDARIO ==========

        onSelectionChange: function(oEvent) {
            const oTable = this.byId("promotionsTable");
            const aSelectedItems = oTable.getSelectedItems();
            const oModel = this.getView().getModel("promotionsModel");
            oModel.setProperty("/selectedCount", aSelectedItems.length);
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
                MessageBox.warning("Por favor selecciona solo una promoción para editar.");
                return;
            }

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
            
            const oEditModel = this.getView().getModel("editPromoModel");
            oEditModel.setData(editData);
            
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
                return oPromotion.ProductosAplicables.filter(function(p) {
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
                        selected: false
                    });
                }
                productMap.get(skuid).presentaciones.push(presentacion);
            });
            
            return Array.from(productMap.values());
        },

        onEditTabSelect: function(oEvent) {
            const sKey = oEvent.getParameter("key");
            console.log("Tab de edición seleccionado:", sKey);
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
            
            aGrouped.forEach(function(product) {
                product.selected = bSelectAll;
                product.presentaciones.forEach(function(pres) {
                    pres.selected = bSelectAll;
                });
            });
            
            oEditModel.setProperty("/groupedProducts", aGrouped);
            oEditModel.setProperty("/selectedProductsCount", bSelectAll ? totalPresentaciones : 0);
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
            const oList = this.byId("editProductsList");
            const aSelectedItems = oList.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("No hay productos seleccionados para eliminar.");
                return;
            }
            
            const that = this;
            MessageBox.confirm(
                `¿Estás seguro de eliminar ${aSelectedItems.length} producto(s) de la promoción?`,
                {
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            const skuidsToRemove = new Set();
                            aSelectedItems.forEach(function(oItem) {
                                const oContext = oItem.getBindingContext("editPromoModel");
                                const oProduct = oContext.getObject();
                                skuidsToRemove.add(oProduct.SKUID);
                            });
                            
                            const aProductos = oEditModel.getProperty("/ProductosAplicables");
                            const aFiltered = aProductos.filter(function(p) {
                                return !skuidsToRemove.has(p.SKUID);
                            });
                            
                            oEditModel.setProperty("/ProductosAplicables", aFiltered);
                            oEditModel.setProperty("/groupedProducts", that._groupProductsBySkuid(aFiltered));
                            oEditModel.setProperty("/selectedProductsCount", 0);
                            
                            oList.removeSelections();
                            MessageToast.show(`${aSelectedItems.length} producto(s) eliminado(s)`);
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
            
            if (!this._addProductsDialog) {
                this._addProductsDialog = await Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.AddProductsFilterDialog",
                    controller: this
                });
                oView.addDependent(this._addProductsDialog);
            }
            
            // Obtener presentaciones ya seleccionadas en la promoción
            const oEditModel = this.getView().getModel("editPromoModel");
            const aProductosAplicables = oEditModel.getProperty("/ProductosAplicables") || [];
            const lockedIds = aProductosAplicables.map(function(p) { return p.IdPresentaOK; });
            
            // Inicializar modelo de filtros
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/lockedPresentaciones", lockedIds);
            oFilterModel.setProperty("/selectedPresentacionesCount", 0);
            oFilterModel.setProperty("/errorMessage", "");
            
            // Cargar datos de productos y categorías
            await this._loadFilterData();
            
            this._addProductsDialog.open();
        },

        _loadFilterData: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/loading", true);
            oFilterModel.setProperty("/errorMessage", "");
            
            try {
                console.log("🔄 Cargando datos de filtros...");
                
                // Cargar productos
                const oProductsResponse = await this._callApi('/ztproductos/crudProductos', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
                console.log("📦 Respuesta de productos:", oProductsResponse);
                
                let aProducts = [];
                // Intentar múltiples estructuras de respuesta
                if (oProductsResponse?.data?.[0]?.dataRes) {
                    aProducts = oProductsResponse.data[0].dataRes;
                }
                else if (oProductsResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aProducts = oProductsResponse.value[0].data[0].dataRes;
                }
                else if (Array.isArray(oProductsResponse?.data)) {
                    aProducts = oProductsResponse.data;
                }
                else if (Array.isArray(oProductsResponse)) {
                    aProducts = oProductsResponse;
                }
                
                console.log("✅ Productos extraídos:", aProducts.length);
                
                // Filtrar solo productos activos
                const aActiveProducts = aProducts.filter(function(p) {
                    return p.ACTIVED === true && p.DELETED !== true;
                });
                
                console.log("✅ Productos activos:", aActiveProducts.length);
                
                // Cargar categorías
                const oCategoriesResponse = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
                console.log("📂 Respuesta de categorías:", oCategoriesResponse);
                
                let aCategories = [];
                // Intentar múltiples estructuras de respuesta
                if (oCategoriesResponse?.data?.[0]?.dataRes) {
                    aCategories = oCategoriesResponse.data[0].dataRes;
                }
                else if (oCategoriesResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aCategories = oCategoriesResponse.value[0].data[0].dataRes;
                }
                else if (Array.isArray(oCategoriesResponse?.data)) {
                    aCategories = oCategoriesResponse.data;
                }
                else if (Array.isArray(oCategoriesResponse)) {
                    aCategories = oCategoriesResponse;
                }
                
                console.log("✅ Categorías extraídas:", aCategories.length);
                
                // Filtrar solo categorías activas
                const aActiveCategories = aCategories.filter(function(c) {
                    return c.ACTIVED === true && c.DELETED !== true;
                });
                
                console.log("✅ Categorías activas:", aActiveCategories.length);
                
                // Extraer marcas únicas
                const brandsSet = new Set();
                aActiveProducts.forEach(function(p) {
                    if (p.MARCA && p.MARCA.trim() !== '') {
                        brandsSet.add(p.MARCA.trim());
                    }
                });
                
                const aBrands = Array.from(brandsSet).map(function(marca) {
                    const count = aActiveProducts.filter(function(p) { return p.MARCA === marca; }).length;
                    return {
                        id: marca,
                        name: marca,
                        productos: count
                    };
                }).sort(function(a, b) {
                    return a.name.localeCompare(b.name);
                });
                
                console.log("✅ Marcas extraídas:", aBrands.length, aBrands);
                
                oFilterModel.setProperty("/allProducts", aActiveProducts);
                oFilterModel.setProperty("/allCategories", aActiveCategories);
                oFilterModel.setProperty("/allBrands", aBrands);
                
                console.log("📊 Datos cargados en modelo:", {
                    productos: aActiveProducts.length,
                    categorias: aActiveCategories.length,
                    marcas: aBrands.length
                });
                
                // Aplicar filtros iniciales
                this._applyProductFilters();
                
            } catch (error) {
                console.error("❌ Error cargando datos de filtros:", error);
                oFilterModel.setProperty("/errorMessage", "Error al cargar productos: " + error.message);
            } finally {
                oFilterModel.setProperty("/loading", false);
            }
        },

        _applyProductFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aAllProducts = oFilterModel.getProperty("/allProducts");
            const oFilters = oFilterModel.getProperty("/filters");
            const sSearchTerm = oFilterModel.getProperty("/searchTerm");
            
            console.log("🔍 Aplicando filtros...", {
                totalProductos: aAllProducts.length,
                filtros: oFilters,
                busqueda: sSearchTerm
            });
            
            let aFiltered = aAllProducts.filter(function(product) {
                // Filtro de búsqueda
                if (sSearchTerm && sSearchTerm.trim() !== '') {
                    const searchLower = sSearchTerm.toLowerCase();
                    const matchesSearch =
                        (product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(searchLower)) ||
                        (product.SKUID && product.SKUID.toLowerCase().includes(searchLower)) ||
                        (product.MARCA && product.MARCA.toLowerCase().includes(searchLower));
                    
                    if (!matchesSearch) return false;
                }
                
                // Filtro de marcas
                if (oFilters.marcas && oFilters.marcas.length > 0) {
                    if (!product.MARCA || !oFilters.marcas.includes(product.MARCA)) {
                        return false;
                    }
                }
                
                // Filtro de categorías
                if (oFilters.categorias && oFilters.categorias.length > 0) {
                    if (!product.CATEGORIAS || !Array.isArray(product.CATEGORIAS)) {
                        return false;
                    }
                    const hasCategory = product.CATEGORIAS.some(function(cat) {
                        return oFilters.categorias.includes(cat);
                    });
                    if (!hasCategory) return false;
                }
                
                // Filtro de precio
                if (oFilters.precioMin && product.PRECIO < parseFloat(oFilters.precioMin)) {
                    return false;
                }
                if (oFilters.precioMax && product.PRECIO > parseFloat(oFilters.precioMax)) {
                    return false;
                }
                
                // Filtro de fecha
                if (oFilters.fechaIngresoDesde) {
                    const dateFrom = new Date(oFilters.fechaIngresoDesde);
                    const productDate = new Date(product.REGDATE);
                    if (productDate < dateFrom) return false;
                }
                if (oFilters.fechaIngresoHasta) {
                    const dateTo = new Date(oFilters.fechaIngresoHasta);
                    const productDate = new Date(product.REGDATE);
                    if (productDate > dateTo) return false;
                }
                
                return true;
            });
            
            console.log("✅ Productos filtrados:", aFiltered.length);
            
            // Agregar información de presentaciones
            aFiltered = aFiltered.map(function(product) {
                return {
                    SKUID: product.SKUID,
                    PRODUCTNAME: product.PRODUCTNAME,
                    MARCA: product.MARCA,
                    PRECIO: product.PRECIO,
                    CATEGORIAS: product.CATEGORIAS,
                    REGDATE: product.REGDATE,
                    ACTIVED: product.ACTIVED,
                    expanded: false,
                    presentaciones: [],
                    presentacionesCount: 0,
                    loadingPresentaciones: false
                };
            });
            
            oFilterModel.setProperty("/filteredProducts", aFiltered);
            oFilterModel.setProperty("/filteredProductsCount", aFiltered.length);
            
            console.log("📊 Resultados actualizados:", aFiltered.length, "productos");
            
            // Actualizar contador de filtros activos
            this._updateActiveFiltersCount();
        },

        _updateActiveFiltersCount: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters");
            const sSearchTerm = oFilterModel.getProperty("/searchTerm");
            
            let count = 0;
            if (oFilters.categorias && oFilters.categorias.length > 0) count++;
            if (oFilters.marcas && oFilters.marcas.length > 0) count++;
            if (oFilters.precioMin || oFilters.precioMax) count++;
            if (oFilters.fechaIngresoDesde || oFilters.fechaIngresoHasta) count++;
            if (sSearchTerm && sSearchTerm.trim() !== '') count++;
            
            oFilterModel.setProperty("/activeFiltersCount", count);
        },

        onFilterSearch: function(oEvent) {
            const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", sValue);
            this._applyProductFilters();
        },

        onFilterCategoryChange: function(oEvent) {
            console.log("🔄 Evento de cambio de categoría", oEvent);
            const aSelectedItems = oEvent.getParameter("selectedItems");
            console.log("📊 Items seleccionados:", aSelectedItems);
            const aKeys = aSelectedItems.map(function(item) {
                return item.getKey();
            });
            console.log("🔑 Keys extraídos:", aKeys);
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/filters/categorias", aKeys);
            console.log("✅ Categorías actualizadas en modelo:", oFilterModel.getProperty("/filters/categorias"));
            this._applyProductFilters();
        },

        onFilterBrandChange: function(oEvent) {
            const aSelectedItems = oEvent.getParameter("selectedItems");
            const aKeys = aSelectedItems.map(function(item) {
                return item.getKey();
            });
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/filters/marcas", aKeys);
            this._applyProductFilters();
        },

        onFilterPriceChange: function() {
            this._applyProductFilters();
        },

        onFilterDateChange: function() {
            this._applyProductFilters();
        },

        onClearFilters: function() {
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

        onFilterToggleProduct: async function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const oProduct = oContext.getObject();
            const bExpanded = oProduct.expanded;
            
            oFilterModel.setProperty(sPath + "/expanded", !bExpanded);
            
            // Si se está expandiendo y no se han cargado las presentaciones
            if (!bExpanded && oProduct.presentaciones.length === 0) {
                oFilterModel.setProperty(sPath + "/loadingPresentaciones", true);
                
                try {
                    const oPresentacionesResponse = await this._callApi('/ztproductospresentaciones/crudProductosPresentaciones', 'POST', {}, {
                        ProcessType: 'GetAll',
                        SKUID: oProduct.SKUID,
                        DBServer: 'MongoDB'
                    });
                    
                    let aPresentaciones = [];
                    if (oPresentacionesResponse && oPresentacionesResponse.value && Array.isArray(oPresentacionesResponse.value) && oPresentacionesResponse.value.length > 0) {
                        const mainResponse = oPresentacionesResponse.value[0];
                        if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                            const dataResponse = mainResponse.data[0];
                            if (dataResponse.dataRes && Array.isArray(dataResponse.dataRes)) {
                                aPresentaciones = dataResponse.dataRes;
                            }
                        }
                    }
                    
                    // Filtrar activas y agregar información adicional
                    const lockedIds = oFilterModel.getProperty("/lockedPresentaciones");
                    const aPresentacionesActivas = aPresentaciones
                        .filter(function(p) { return p.ACTIVED === true && p.DELETED !== true; })
                        .map(function(p) {
                            return {
                                ...p,
                                selected: false,
                                locked: lockedIds.includes(p.IdPresentaOK),
                                precio: 0,
                                listaPrecios: ''
                            };
                        });
                    
                    // Cargar precios para cada presentación
                    for (const pres of aPresentacionesActivas) {
                        try {
                            const oPreciosResponse = await this._callApi('/ztpreciositems/crudPreciosItems', 'POST', {}, {
                                ProcessType: 'GetAll',
                                IdPresentaOK: pres.IdPresentaOK,
                                DBServer: 'MongoDB'
                            });
                            
                            let aPrecios = [];
                            if (oPreciosResponse && oPreciosResponse.value && Array.isArray(oPreciosResponse.value) && oPreciosResponse.value.length > 0) {
                                const mainResponse = oPreciosResponse.value[0];
                                if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                                    const dataResponse = mainResponse.data[0];
                                    if (dataResponse.dataRes && Array.isArray(dataResponse.dataRes)) {
                                        aPrecios = dataResponse.dataRes;
                                    }
                                }
                            }
                            
                            if (aPrecios.length > 0) {
                                pres.precio = aPrecios[0].Precio || 0;
                                pres.listaPrecios = aPrecios[0].IdListaPreciosOK || '';
                            }
                        } catch (error) {
                            console.error("Error cargando precios:", error);
                        }
                    }
                    
                    oFilterModel.setProperty(sPath + "/presentaciones", aPresentacionesActivas);
                    oFilterModel.setProperty(sPath + "/presentacionesCount", aPresentacionesActivas.length);
                    
                } catch (error) {
                    console.error("Error cargando presentaciones:", error);
                    MessageToast.show("Error al cargar presentaciones");
                } finally {
                    oFilterModel.setProperty(sPath + "/loadingPresentaciones", false);
                }
            }
        },

        onFilterPresentacionSelect: function(oEvent) {
            const oCheckBox = oEvent.getSource();
            const bSelected = oCheckBox.getSelected();
            const oContext = oCheckBox.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            
            oFilterModel.setProperty(sPath + "/selected", bSelected);
            this._updateSelectedPresentacionesCount();
        },

        onFilterTogglePresentacion: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("filterModel");
            const oPresentacion = oContext.getObject();
            
            if (oPresentacion.locked) {
                MessageToast.show("Esta presentación ya está en la promoción");
                return;
            }
            
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const bCurrentlySelected = oPresentacion.selected;
            
            oFilterModel.setProperty(sPath + "/selected", !bCurrentlySelected);
            this._updateSelectedPresentacionesCount();
        },

        _updateSelectedPresentacionesCount: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts");
            
            let count = 0;
            aProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected) count++;
                    });
                }
            });
            
            oFilterModel.setProperty("/selectedPresentacionesCount", count);
        },

        onSelectAllFilteredProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts");
            
            // Determinar si seleccionar o deseleccionar
            const currentCount = oFilterModel.getProperty("/selectedPresentacionesCount");
            const bSelectAll = currentCount === 0;
            
            aProducts.forEach(function(product, productIndex) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres, presIndex) {
                        if (!pres.locked) {
                            oFilterModel.setProperty(
                                `/filteredProducts/${productIndex}/presentaciones/${presIndex}/selected`,
                                bSelectAll
                            );
                        }
                    });
                }
            });
            
            this._updateSelectedPresentacionesCount();
        },

        onConfirmAddProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oEditModel = this.getView().getModel("editPromoModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts");
            const aCurrentProducts = oEditModel.getProperty("/ProductosAplicables") || [];
            
            // Recopilar presentaciones seleccionadas
            const aNewPresentaciones = [];
            aProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected && !pres.locked) {
                            aNewPresentaciones.push({
                                IdPresentaOK: pres.IdPresentaOK,
                                SKUID: product.SKUID,
                                NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                                Precio: pres.precio,
                                NombreProducto: product.PRODUCTNAME,
                                selected: false
                            });
                        }
                    });
                }
            });
            
            if (aNewPresentaciones.length === 0) {
                MessageBox.warning("No hay presentaciones seleccionadas para agregar");
                return;
            }
            
            // Combinar con productos existentes
            const aCombined = [...aCurrentProducts, ...aNewPresentaciones];
            
            oEditModel.setProperty("/ProductosAplicables", aCombined);
            oEditModel.setProperty("/groupedProducts", this._groupProductsBySkuid(aCombined));
            
            MessageToast.show(`${aNewPresentaciones.length} presentación(es) agregada(s) a la promoción`);
            this._addProductsDialog.close();
        },

        onCancelAddProducts: function() {
            this._addProductsDialog.close();
        },

        onCloseFilterDialog: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            // Limpiar datos al cerrar
            oFilterModel.setProperty("/filteredProducts", []);
            oFilterModel.setProperty("/selectedPresentacionesCount", 0);
        },

        onProductSearch: function(oEvent) {
            const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/productSearchTerm", sValue);
            this._applyProductFilters();
        },

        onSelectAllProducts: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts");
            
            aProducts.forEach(function(product, productIndex) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres, presIndex) {
                        if (!pres.locked) {
                            oFilterModel.setProperty(
                                `/filteredProducts/${productIndex}/presentaciones/${presIndex}/selected`,
                                bSelected
                            );
                        }
                    });
                }
            });
            
            this._updateSelectedPresentacionesCount();
        },

        onClearSelection: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts");
            
            aProducts.forEach(function(product, productIndex) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres, presIndex) {
                        oFilterModel.setProperty(
                            `/filteredProducts/${productIndex}/presentaciones/${presIndex}/selected`,
                            false
                        );
                    });
                }
            });
            
            this._updateSelectedPresentacionesCount();
        },

        onPresentacionPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("filterModel");
            const oPresentacion = oContext.getObject();
            
            if (oPresentacion.locked) {
                MessageToast.show("Esta presentación ya está en la promoción");
                return;
            }
            
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const bCurrentlySelected = oPresentacion.selected;
            
            oFilterModel.setProperty(sPath + "/selected", !bCurrentlySelected);
            this._updateSelectedPresentacionesCount();
        },

        // ========== FIN MÉTODOS DE FILTROS ==========

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
                    ACTIVED: oData.ACTIVED
                };
                
                if (oData.TipoDescuento === 'PORCENTAJE' && oData.DescuentoPorcentaje > 0) {
                    updateData.DescuentoPorcentaje = oData.DescuentoPorcentaje;
                    updateData.DescuentoMonto = 0;
                } else if (oData.TipoDescuento === 'MONTO_FIJO' && oData.DescuentoMonto > 0) {
                    updateData.DescuentoMonto = oData.DescuentoMonto;
                    updateData.DescuentoPorcentaje = 0;
                }
                
                console.log("📤 Actualizando promoción:", updateData);
                
                await this._callApi('/ztpromociones/crudPromociones', 'POST', updateData, {
                    ProcessType: 'UpdateOne',
                    IdPromoOK: oData.IdPromoOK,
                    DBServer: 'MongoDB'
                });
                
                MessageToast.show("Promoción actualizada correctamente");
                this._editDialog.close();
                this.loadPromotions();
                
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
                                for (const oItem of aSelectedItems) {
                                    const oContext = oItem.getBindingContext("promotionsModel");
                                    const oPromotion = oContext.getObject();
                                    
                                    await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                                        ProcessType: 'DeleteHard',
                                        IdPromoOK: oPromotion.IdPromoOK,
                                        DBServer: 'MongoDB'
                                    });
                                }
                                
                                MessageToast.show(`${aSelectedItems.length} promoción(es) eliminada(s) correctamente`);
                                oTable.removeSelections();
                                that.loadPromotions(); // Recargar la lista
                                
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
                for (const oItem of aSelectedItems) {
                    const oContext = oItem.getBindingContext("promotionsModel");
                    const oPromotion = oContext.getObject();
                    
                    await that._callApi('/ztpromociones/crudPromociones', 'POST', {}, {
                        ProcessType: 'DeleteLogic',
                        IdPromoOK: oPromotion.IdPromoOK,
                        DBServer: 'MongoDB'
                    });
                }
                
                MessageToast.show(`${aSelectedItems.length} promoción(es) desactivada(s) correctamente`);
                oTable.removeSelections();
                that.loadPromotions(); // Recargar la lista
                
            } catch (error) {
                MessageBox.error("Error al desactivar promociones: " + error.message);
            }
        },

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            const oTable = this.byId("promotionsTable");
            const oBinding = oTable.getBinding("items");
            
            if (sQuery && sQuery.length > 0) {
                const aFilters = [
                    new Filter("Titulo", FilterOperator.Contains, sQuery),
                    new Filter("Descripcion", FilterOperator.Contains, sQuery),
                    new Filter("IdPromoOK", FilterOperator.Contains, sQuery)
                ];
                const oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onPromotionPress: function (oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("promotionsModel");
            const oPromotion = oContext.getObject();
            
            console.log("Promoción seleccionada:", oPromotion);
            MessageToast.show("Promoción: " + oPromotion.Titulo);
            
            // TODO: Abrir vista de detalle o diálogo con información completa
        },

        onNavBack: function () {
            console.log("Navegando hacia atrás");
            const oHistory = sap.ui.core.routing.History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteMain", {}, true);
            }
        }
    });
});