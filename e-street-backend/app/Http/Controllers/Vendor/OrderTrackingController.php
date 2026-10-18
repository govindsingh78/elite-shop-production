<?php

namespace App\Http\Controllers\Vendor;

use App\Http\Controllers\Admin\OrderTrackingController as AdminOrderTrackingController;
use App\Models\Order;
use Illuminate\Http\Request;

/** Tracking updates for orders a vendor fulfils entirely on their own. */
class OrderTrackingController extends AdminOrderTrackingController
{
    protected function authorizeOrder(Request $request, Order $order): void
    {
        OrderController::authorizeShipping($order, $request->user()->id);
    }

    protected function present(Request $request, Order $order): Order
    {
        return OrderController::present($order, $request->user()->id);
    }
}
