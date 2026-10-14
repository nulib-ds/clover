import dynamic from "next/dynamic";
import { useRouter } from "next/router";

// todo: set this as a constant somewhere?
const defaultIiifContent =
  "https://iiif-maktaba.dc.library.northwestern.edu/dc8ff749-adad-42a7-81e0-0eb473ef88a5.json";

const Scroll = dynamic(() => import("@samvera/clover-iiif/scroll"), {
  ssr: false,
});

const CloverScroll = ({
  iiifContent,
  options,
}: {
  iiifContent?: string;
  options;
}) => {
  const router = useRouter();

  /*
   * An explicit prop wins over the URL.
   *
   * `iiif-content` is how the docs hand a pasted resource to a component rendered with no
   * prop of its own. The playground passes the resource as a prop *and* mirrors it into the
   * URL so a configuration can be shared — so if the param won, the playground's resource
   * field would look dead: it updates the prop as you type but only syncs the URL on blur.
   */
  const iiifResource =
    iiifContent ||
    (router.query["iiif-content"] as string) ||
    defaultIiifContent;

  return (
    <Scroll iiifContent={iiifResource} key={iiifResource} options={options} />
  );
};

export default CloverScroll;
