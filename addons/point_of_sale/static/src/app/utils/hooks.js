/** @odoo-module */
import { OfflineErrorPopup } from "@point_of_sale/app/errors/popups/offline_error_popup";
import { ConfirmPopup } from "@point_of_sale/app/utils/confirm_popup/confirm_popup";
import { ErrorTracebackPopup } from "@point_of_sale/app/errors/popups/error_traceback_popup";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { useEnv, onMounted, onPatched, onWillUnmount, useComponent, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * Introduce error handlers in the component.
 *
 * IMPROVEMENT: This is a terrible hook. There could be a better way to handle
 * the error when the order failed to sync.
 * FIXME POSREF: move this to the error_handler registry.
 */
export function useErrorHandlers() {
    const component = useComponent();
    const popup = useEnv().services.popup;

    component._handlePushOrderError = async function (error) {
        // This error handler receives `error` equivalent to `error.message` of the rpc error.
        if (error.message === "Backend Invoice") {
            await popup.add(ConfirmPopup, {
                title: this.env._t("Please print the invoice from the backend"),
                body:
                    this.env._t(
                        "The order has been synchronized earlier. Please make the invoice from the backend for the order: "
                    ) + error.data.order.name,
            });
        } else if (error.code < 0) {
            // XmlHttpRequest Errors
            const title = this.env._t("Unable to sync order");
            const body = this.env._t(
                "Check the internet connection then try to sync again by clicking on the red wifi button (upper right of the screen)."
            );
            await popup.add(OfflineErrorPopup, { title, body });
        } else if (error.code === 200) {
            // OpenERP Server Errors
            await popup.add(ErrorTracebackPopup, {
                title: error.data.message || this.env._t("Server Error"),
                body:
                    error.data.debug ||
                    this.env._t("The server encountered an error while receiving your order."),
            });
        } else if (error.code === 700) {
            // Sweden Fiscal module errors
            await popup.add(ErrorPopup, {
                title: this.env._t("Fiscal data module error"),
                body:
                    error.data.error.status ||
                    this.env._t(
                        "The fiscal data module encountered an error while receiving your order."
                    ),
            });
        } else if (error.code === 701) {
            // Belgian Fiscal module errors
            let bodyMessage = "";
            if (error.error.errorCode) {
                bodyMessage = "'" + error.error.errorCode + "': " + error.error.errorMessage;
            } else {
                bodyMessage = "Fiscal data module is not on.";
            }
            await popup.add(ErrorPopup, {
                title: this.env._t("Fiscal data module error"),
                body: bodyMessage,
            });
        } else {
            // ???
            await popup.add(ErrorPopup, {
                title: this.env._t("Unknown Error"),
                body: this.env._t(
                    "The order could not be sent to the server due to an unknown error"
                ),
            });
        }
    };
}

/**
 * Assumes t-ref="root" in the root element of the component that uses this hook.
 */
export function useAutoFocusToLast() {
    const root = useRef("root");
    let target = null;
    function autofocus() {
        const prevTarget = target;
        const allInputs = root.el.querySelectorAll("input");
        target = allInputs[allInputs.length - 1];
        if (target && target !== prevTarget) {
            target.focus();
            target.selectionStart = target.selectionEnd = target.value.length;
        }
    }
    onMounted(autofocus);
    onPatched(autofocus);
}

export function useValidateCashInput(inputRef, startingValue) {
    const cashInput = useRef(inputRef);
    const localization = useService("localization");
    const decimalPoint = localization.decimalPoint;
    const env = useEnv();
    function handleCashInputChange(event) {
        const inputValue = (event.target.value || "").trim();

        // Check if the current input value is a valid float
        const inputElement = event.target.closest(".input-container") || event.target;
        if (!env.utils.isValidFloat(inputValue)) {
            inputElement.classList.add("is-invalid");
            event.target.classList.add("invalid-cash-input");
        } else {
            inputElement.classList.remove("is-invalid");
            event.target.classList.remove("invalid-cash-input");
        }
    }
    onMounted(() => {
        if (cashInput.el) {
            cashInput.el.value = (startingValue || 0).toString().replace(".", decimalPoint);
            cashInput.el.addEventListener("input", handleCashInputChange);
        }
    });
    onWillUnmount(() => {
        if (cashInput.el) {
            cashInput.el.removeEventListener("input", handleCashInputChange);
        }
    });
}
