sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, MessageBox, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.promociones.Promociones", {

        onInit: function () {
            console.log("Iniciando Promociones Controller");
            
            // Modelo con datos similares a la imagen
            var oModel = new JSONModel({
                promotions: [],
                totalPromotions: 0,
                activePromotions: 0,
                searchText: ""
            });
            
            this.getView().setModel(oModel, "promotionsModel");
            
            // Cargar datos automáticamente
            this.loadPromotions();
        },

        loadPromotions: function () {
            console.log("Cargando promociones...");
            
            var aPromotions = [
                {
                    id: "PROMO_176281284379_LZUX06",
                    title: "Black Friday 2025 - Ofertas Especiales",
                    description: "Descuentos increíbles",
                    discount: "25.0%",
                    discountState: "Success",
                    validityPeriod: "27/11/2025 - 24/12/2025",
                    validityStatus: "No vigente",
                    createdBy: "lpaniagua",
                    createdDate: "10/11/2025",
                    status: "Programada",
                    statusState: "Information"
                },
                {
                    id: "PROMO_176273880524B_T0VOE7",
                    title: "Promoción de Lanzamiento O NIO",
                    description: "Celebra el lanzamiento",
                    discount: "55.0%",
                    discountState: "Success",
                    validityPeriod: "09/11/2025 - 23/11/2025",
                    validityStatus: "VIGENTE",
                    createdBy: "SPARDO",
                    createdDate: "09/11/2025",
                    status: "Activa",
                    statusState: "Success"
                },
                {
                    id: "PROMO_176230911543E_8R9U54",
                    title: "Black Friday 2027",
                    description: "Descuento especial A",
                    discount: "100.0%",
                    discountState: "Success",
                    validityPeriod: "24/11/2025 - 29/11/2025",
                    validityStatus: "No vigente",
                    createdBy: "EDUARDO",
                    createdDate: "04/11/2025",
                    status: "Programada",
                    statusState: "Information"
                },
                {
                    id: "PROMO_176230644276_7EV4TW",
                    title: "Black Friday 2025 - Ofertas Especiales",
                    description: "Descuentos increíbles",
                    discount: "12.0%",
                    discountState: "Success",
                    validityPeriod: "04/11/2025 - 09/11/2025",
                    validityStatus: "No vigente",
                    createdBy: "lpaniagua",
                    createdDate: "04/11/2025",
                    status: "Expirada",
                    statusState: "Error"
                },
                {
                    id: "PROMO_176229481919_10YJ03",
                    title: "Black Friday 2025 - Ofertas Especiales",
                    description: "Descuentos increíbles",
                    discount: "55.0%",
                    discountState: "Success",
                    validityPeriod: "24/11/2025 - 25/12/2025",
                    validityStatus: "No vigente",
                    createdBy: "SPARDO",
                    createdDate: "04/11/2025",
                    status: "Programada",
                    statusState: "Information"
                },
                {
                    id: "PROMO_176229870508E_5MEL15",
                    title: "Black Friday 2025 - Apple - 2 productos",
                    description: "Promoción aplicable a",
                    discount: "10.0%",
                    discountState: "Success",
                    validityPeriod: "03/11/2025 - 03/12/2025",
                    validityStatus: "VIGENTE",
                    createdBy: "SPARDO",
                    createdDate: "04/11/2025",
                    status: "Activa",
                    statusState: "Success"
                },
                {
                    id: "PROMO_176229031866_V7ZU60",
                    title: "Promoción de Lanzamiento",
                    description: "Celebra el lanzamiento",
                    discount: "15.0%",
                    discountState: "Success",
                    validityPeriod: "03/11/2025 - 17/11/2025",
                    validityStatus: "VIGENTE",
                    createdBy: "SPARDO",
                    createdDate: "04/11/2025",
                    status: "Activa",
                    statusState: "Success"
                },
                {
                    id: "PROMO003",
                    title: "Descuento invierno 2026",
                    description: "15% de descuento en",
                    discount: "1.0%",
                    discountState: "Success",
                    validityPeriod: "18/10/2025 - 30/12/2025",
                    validityStatus: "VIGENTE",
                    createdBy: "lpaniagua",
                    createdDate: "20/10/2025",
                    status: "Activa",
                    statusState: "Success"
                }
            ];

            var oModel = this.getView().getModel("promotionsModel");
            oModel.setProperty("/promotions", aPromotions);
            oModel.setProperty("/totalPromotions", aPromotions.length);
            oModel.setProperty("/activePromotions", aPromotions.filter(p => p.status === "Activa").length);
            
            MessageToast.show("Promociones cargadas: " + aPromotions.length);
            console.log("Promociones cargadas correctamente:", aPromotions);
        },

        onNewPromotion: function () {
            MessageToast.show("Funcionalidad 'Nueva Promoción' por implementar");
        },

        onEditPromotion: function () {
            var oTable = this.byId("promotionsTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción para editar.");
                return;
            }
            
            MessageToast.show("Editar " + aSelectedItems.length + " promoción(es) seleccionada(s)");
        },

        onDeletePromotion: function () {
            var oTable = this.byId("promotionsTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción para eliminar.");
                return;
            }
            
            MessageBox.confirm(
                "¿Estás seguro de que quieres eliminar " + aSelectedItems.length + " promoción(es)?",
                {
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            MessageToast.show("Promociones eliminadas correctamente");
                            oTable.removeSelections();
                        }
                    }
                }
            );
        },

        onDeactivatePromotion: function () {
            var oTable = this.byId("promotionsTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una promoción para desactivar.");
                return;
            }
            
            MessageToast.show("Desactivar " + aSelectedItems.length + " promoción(es) seleccionada(s)");
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query");
            var oTable = this.byId("promotionsTable");
            var oBinding = oTable.getBinding("items");
            
            if (sQuery && sQuery.length > 0) {
                var aFilters = [
                    new Filter("title", FilterOperator.Contains, sQuery),
                    new Filter("description", FilterOperator.Contains, sQuery),
                    new Filter("id", FilterOperator.Contains, sQuery)
                ];
                var oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onPromotionPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("promotionsModel");
            var oPromotion = oContext.getObject();
            
            MessageToast.show("Promoción seleccionada: " + oPromotion.title);
        },

        onNavBack: function () {
            console.log("Navegando hacia atrás");
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("RouteMain", {}, true);
            }
        }
    });
});