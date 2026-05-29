"""
Re-export all test classes for backward compatibility.
`apps.finance.tests.ClassName` continues to work after the split.
"""

from apps.finance.tests.test_export import InvoiceCSVExportTests
from apps.finance.tests.test_invoice_actions import (
    InvoiceListFilterTests,
    InvoiceSendEmailTests,
    OverdueReminderTests,
)
from apps.finance.tests.test_invoice_finance import (
    FinanceStatsViewTests,
    InvoiceAgingBucketsTests,
    InvoiceAgingTests,
    InvoiceVatRateSnapshotTests,
    MultiProcedurePricingTests,
)
from apps.finance.tests.test_invoice_lifecycle import (
    ConcurrentInvoiceSequenceTests,
    InvoiceLifecycleApiTests,
    InvoiceSequenceTests,
    InvoiceSkFormatTests,
    ProformaInvoiceTests,
)
from apps.finance.tests.test_pricelist import (
    PriceListCrudApiTests,
    PriceListExportCsvTests,
    ProcedureCatalogTests,
)
from apps.finance.tests.test_subscription import (
    SubscriptionApiTests,
    SubscriptionExtendedFieldsTests,
)

__all__ = [
    "SubscriptionApiTests",
    "SubscriptionExtendedFieldsTests",
    "InvoiceLifecycleApiTests",
    "InvoiceSequenceTests",
    "ConcurrentInvoiceSequenceTests",
    "ProformaInvoiceTests",
    "InvoiceSkFormatTests",
    "FinanceStatsViewTests",
    "InvoiceVatRateSnapshotTests",
    "MultiProcedurePricingTests",
    "InvoiceAgingBucketsTests",
    "InvoiceAgingTests",
    "InvoiceSendEmailTests",
    "OverdueReminderTests",
    "InvoiceListFilterTests",
    "PriceListCrudApiTests",
    "ProcedureCatalogTests",
    "PriceListExportCsvTests",
    "InvoiceCSVExportTests",
]
