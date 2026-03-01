import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

class InvoiceErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Invoice page crashed:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="max-w-2xl mx-auto mt-10 p-6 rounded-lg border bg-card space-y-4">
                    <div className="flex items-start gap-3 text-destructive">
                        <AlertTriangle className="h-5 w-5 mt-0.5" />
                        <div>
                            <h2 className="text-lg font-semibold">Nepodarilo sa načítať faktúru</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Stránka faktúry spadla. Môžete skúsiť znovu načítať túto stránku alebo sa vrátiť na zoznam faktúr.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={this.handleRetry}>
                            Skúsiť znova
                        </Button>
                        <a href="/invoices" className="inline-flex">
                            <Button type="button" variant="outline">
                                Späť na faktúry
                            </Button>
                        </a>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default InvoiceErrorBoundary;
