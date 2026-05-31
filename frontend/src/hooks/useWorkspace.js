export function createUseWorkspace({ loadWorkspace, tokenKey }) {
  return function useWorkspace() {
    const [state, setState] = React.useState(window.__MOLARIS_WORKSPACE || { loading: true, error: null });
    React.useEffect(() => {
      let alive = true;
      const refresh = () => {
        if (!localStorage.getItem(tokenKey)) {
          setState({ loading: false, error: null });
          return;
        }
        setState((current) => ({ ...current, loading: true, error: null }));
        loadWorkspace()
          .then((data) => {
            if (!alive) return;
            window.__MOLARIS_WORKSPACE = { ...data, loading: false, error: null };
            setState(window.__MOLARIS_WORKSPACE);
          })
          .catch((error) => {
            if (!alive) return;
            setState({ loading: false, error: error.message });
          });
      };
      refresh();
      window.addEventListener('molaris-workspace-refresh', refresh);
      return () => {
        alive = false;
        window.removeEventListener('molaris-workspace-refresh', refresh);
      };
    }, []);
    return state;
  };
}
