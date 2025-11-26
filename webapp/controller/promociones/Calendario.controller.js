sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/ObjectStatus"
], function (Controller, JSONModel, MessageToast, MessageBox, DateFormat, VBox, Text, Title, ObjectStatus) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.promociones.Calendario", {

        // ================================================================================
        // LIFECYCLE METHODS
        // ================================================================================

        onInit: function () {
            const today = new Date();
            
            const oModel = new JSONModel({
                currentDate: today,
                currentMonthYear: this._getMonthYearText(today),
                viewMode: "month",
                filters: {
                    estado: "all",
                    search: ""
                },
                promotions: [],
                filteredPromotions: [],
                calendarDays: []
            });
            
            this.getView().setModel(oModel, "calendarModel");
            
            // Modelo para detalle de promoción
            this.getView().setModel(new JSONModel({}), "detailModel");
            
            this.loadPromotions();
            
            this.getOwnerComponent().getRouter().getRoute("RouteCalendario")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            // Solo recargar si no hay datos cargados
            const oModel = this.getView().getModel("calendarModel");
            const aPromotions = oModel.getProperty("/promotions");
            
            if (!aPromotions || aPromotions.length === 0) {
                this.loadPromotions();
            }
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePromociones", {}, true);
        },

        // ================================================================================
        // API METHODS - CRUD OPERATIONS
        // ================================================================================

        /**
         * Llama a la API REST del backend
         * @param {string} sRelativeUrl - URL relativa del endpoint
         * @param {string} sMethod - Método HTTP (GET, POST, etc.)
         * @param {object} oData - Datos a enviar en el body
         * @param {object} oParams - Parámetros de query string
         * @returns {Promise} Promesa con la respuesta de la API
         */
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
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        /**
         * CRUD: READ - Carga todas las promociones desde el backend
         * Endpoint: /ztpromociones/crudPromociones
         * ProcessType: GetAll
         */
        loadPromotions: async function() {
            // Evitar llamadas simultáneas
            if (this._isLoadingPromotions) {
                return;
            }
            
            this._isLoadingPromotions = true;
            const oModel = this.getView().getModel("calendarModel");
            
            try {
                const oResponse = await this._callApi('/ztpromociones/crudPromociones', 'POST', {}, { 
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
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
                
                oModel.setProperty("/promotions", aPromotions);
                this._applyFilters();
                this._generateCalendarDays();
                
            } catch (error) {
                MessageBox.error("Error al cargar promociones: " + error.message);
                oModel.setProperty("/promotions", []);
            } finally {
                this._isLoadingPromotions = false;
            }
        },

        // ================================================================================
        // BUSINESS LOGIC - FILTERS & CALENDAR
        // ================================================================================

        _applyFilters: function() {
            const oModel = this.getView().getModel("calendarModel");
            const aPromotions = oModel.getProperty("/promotions");
            const oFilters = oModel.getProperty("/filters");
            
            let aFiltered = aPromotions.filter(promo => {
                // Filtro por estado
                if (oFilters.estado !== "all") {
                    const status = this._getPromotionStatus(promo);
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
            aFiltered.sort((a, b) => new Date(a.FechaIni) - new Date(b.FechaIni));
            
            oModel.setProperty("/filteredPromotions", aFiltered);
        },

        _getPromotionStatus: function(oPromotion) {
            if (!oPromotion) return "Inactiva";
            
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

        _generateCalendarDays: function() {
            const oModel = this.getView().getModel("calendarModel");
            const currentDate = oModel.getProperty("/currentDate");
            const aPromotions = oModel.getProperty("/filteredPromotions");
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
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
            
            oModel.setProperty("/calendarDays", aDays);
            this._renderCalendarGrid();
        },

        _renderCalendarGrid: function() {
            const oModel = this.getView().getModel("calendarModel");
            const aDays = oModel.getProperty("/calendarDays");
            const oGrid = this.byId("calendarGrid");
            
            if (!oGrid) return;
            
            oGrid.removeAllItems();
            
            // Crear filas de 7 días (semanas)
            let currentWeek = new sap.m.HBox();
            
            aDays.forEach((dayInfo, index) => {
                const oVBox = new VBox({
                    width: "14.28%",
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
                    dayInfo.promotions.slice(0, 3).forEach(promo => {
                        const sColor = this.getPromotionColor(promo);
                        const sIcon = this._getPromotionIcon(promo);
                        
                        const oPromoBox = new VBox({
                            items: [
                                new Text({
                                    text: sIcon + " " + (promo.Titulo || "").substring(0, 15) + (promo.Titulo && promo.Titulo.length > 15 ? "..." : ""),
                                    wrapping: false
                                }).addStyleClass("calendar-promo-text")
                            ]
                        }).addStyleClass("calendar-promo-item");
                        
                        oPromoBox.addEventDelegate({
                            onclick: function() {
                                this.onPromotionPress({ getSource: function() { 
                                    return { 
                                        getBindingContext: function() { 
                                            return { 
                                                getObject: function() { return promo; } 
                                            }; 
                                        } 
                                    }; 
                                }});
                            }.bind(this)
                        });
                        
                        // Aplicar color de fondo
                        oPromoBox.addStyleClass("promo-" + this._getPromotionStatus(promo));
                        
                        oVBox.addItem(oPromoBox);
                    });
                    
                    // Indicador de más promociones
                    if (dayInfo.promotions.length > 3) {
                        oVBox.addItem(new Text({
                            text: "+" + (dayInfo.promotions.length - 3) + " más"
                        }).addStyleClass("calendar-more-promos"));
                    }
                }
                
                currentWeek.addItem(oVBox);
                
                // Cada 7 días, crear nueva semana
                if ((index + 1) % 7 === 0) {
                    oGrid.addItem(currentWeek);
                    currentWeek = new sap.m.HBox();
                }
            });
            
            // Agregar la última semana si tiene elementos
            if (currentWeek.getItems().length > 0) {
                oGrid.addItem(currentWeek);
            }
        },

        _getPromotionIcon: function(oPromotion) {
            const status = this._getPromotionStatus(oPromotion);
            if (status === "Activa") return "●";
            if (status === "Programada") return "○";
            return "◌";
        },

        _isToday: function(oDate) {
            const today = new Date();
            return oDate.getDate() === today.getDate() &&
                   oDate.getMonth() === today.getMonth() &&
                   oDate.getFullYear() === today.getFullYear();
        },

        // ================================================================================
        // FORMATTERS & HELPERS
        // ================================================================================

        _getMonthYearText: function(oDate) {
            const oDateFormat = DateFormat.getDateInstance({
                pattern: "MMMM yyyy"
            });
            return oDateFormat.format(oDate);
        },

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

        formatDateFull: function(sDate) {
            if (!sDate) return "N/A";
            try {
                const oDate = new Date(sDate);
                const oDateFormat = DateFormat.getDateInstance({
                    pattern: "dd 'de' MMMM 'de' yyyy"
                });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "Fecha inválida";
            }
        },

        getPromotionColor: function(oPromotion) {
            const status = this._getPromotionStatus(oPromotion);
            if (status === "Activa") return "#388e3c";
            if (status === "Programada") return "#1976d2";
            if (status === "Expirada") return "#d32f2f";
            return "#757575"; // Inactiva
        },

        getPromotionStatusText: function(oPromotion) {
            return this._getPromotionStatus(oPromotion);
        },

        getPromotionStatusState: function(oPromotion) {
            const status = this._getPromotionStatus(oPromotion);
            switch (status) {
                case "Activa": return "Success";
                case "Programada": return "Information";
                case "Expirada": return "Error";
                case "Inactiva": return "Warning";
                default: return "None";
            }
        },

        // ================================================================================
        // UI EVENT HANDLERS
        // ================================================================================

        onFilterChange: function() {
            this._applyFilters();
            const oModel = this.getView().getModel("calendarModel");
            const sViewMode = oModel.getProperty("/viewMode");
            
            if (sViewMode === "month") {
                this._generateCalendarDays();
            }
        },

        onViewModeChange: function(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oModel = this.getView().getModel("calendarModel");
            oModel.setProperty("/viewMode", sKey);
            
            if (sKey === "month") {
                this._generateCalendarDays();
            }
        },

        onPreviousMonth: function() {
            const oModel = this.getView().getModel("calendarModel");
            const currentDate = oModel.getProperty("/currentDate");
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() - 1);
            
            oModel.setProperty("/currentDate", newDate);
            oModel.setProperty("/currentMonthYear", this._getMonthYearText(newDate));
            this._generateCalendarDays();
        },

        onNextMonth: function() {
            const oModel = this.getView().getModel("calendarModel");
            const currentDate = oModel.getProperty("/currentDate");
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() + 1);
            
            oModel.setProperty("/currentDate", newDate);
            oModel.setProperty("/currentMonthYear", this._getMonthYearText(newDate));
            this._generateCalendarDays();
        },

        onToday: function() {
            const oModel = this.getView().getModel("calendarModel");
            const today = new Date();
            
            oModel.setProperty("/currentDate", today);
            oModel.setProperty("/currentMonthYear", this._getMonthYearText(today));
            this._generateCalendarDays();
        },

        onPromotionPress: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("calendarModel");
            
            let oPromotion;
            if (oContext) {
                oPromotion = oContext.getObject();
            } else {
                // Fallback para clics desde el calendario
                oPromotion = oEvent.getSource().getObject ? oEvent.getSource().getObject() : null;
            }
            
            if (!oPromotion) return;
            
            // Agrupar presentaciones por producto
            const groupedProducts = this._groupProductsBySkuid(oPromotion.ProductosAplicables || []);
            
            const oDetailModel = this.getView().getModel("detailModel");
            oDetailModel.setData({
                ...oPromotion,
                groupedProducts: groupedProducts
            });
            
            this.byId("promoDetailDialog").open();
        },

        _groupProductsBySkuid: function(aPresentaciones) {
            const grouped = new Map();
            
            aPresentaciones.forEach(presentacion => {
                if (!grouped.has(presentacion.SKUID)) {
                    grouped.set(presentacion.SKUID, {
                        SKUID: presentacion.SKUID,
                        NombreProducto: presentacion.NombreProducto,
                        presentaciones: []
                    });
                }
                grouped.get(presentacion.SKUID).presentaciones.push({
                    IdPresentaOK: presentacion.IdPresentaOK,
                    NombrePresentacion: presentacion.NombrePresentacion,
                    Precio: presentacion.PrecioOriginal || presentacion.Precio
                });
            });
            
            return Array.from(grouped.values());
        },

        onCloseDetailDialog: function() {
            this.byId("promoDetailDialog").close();
        },

        onManagePromotion: function() {
            const oDetailModel = this.getView().getModel("detailModel");
            const oPromotion = oDetailModel.getData();
            
            // Cerrar diálogo
            this.byId("promoDetailDialog").close();
            
            // Navegar a edición (cuando se implemente)
            MessageToast.show("Abriendo editor de promoción: " + oPromotion.Titulo);
            
            // TODO: Navegar a vista de edición
        },

        onExport: function() {
            const oModel = this.getView().getModel("calendarModel");
            const aPromotions = oModel.getProperty("/filteredPromotions");
            
            if (aPromotions.length === 0) {
                MessageBox.warning("No hay promociones para exportar");
                return;
            }
            
            // Preparar datos CSV
            const aHeaders = ['ID', 'Título', 'Descripción', 'Fecha Inicio', 'Fecha Fin', 'Descuento %', 'Estado', 'Creado Por'];
            const aRows = aPromotions.map(promo => [
                promo.IdPromoOK || '',
                promo.Titulo || '',
                promo.Descripcion || '',
                this.formatDateFull(promo.FechaIni),
                this.formatDateFull(promo.FechaFin),
                promo.DescuentoPorcentaje || promo['Descuento%'] || '0',
                this.getPromotionStatusText(promo),
                promo.REGUSER || ''
            ]);
            
            // Crear CSV
            const sCsvContent = [
                aHeaders.join(','),
                ...aRows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');
            
            // Descargar archivo
            const blob = new Blob(['\uFEFF' + sCsvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `promociones_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            MessageToast.show(`${aPromotions.length} promociones exportadas a CSV`);
        }
    });
});

