#ifndef DEFECTS_INJPRESENTER_HPP
#define DEFECTS_INJPRESENTER_HPP

#include <gui/model/ModelListener.hpp>
#include <mvp/Presenter.hpp>

using namespace touchgfx;

class defects_injView;

class defects_injPresenter : public touchgfx::Presenter, public ModelListener
{
public:
    defects_injPresenter(defects_injView& v);

    /**
     * The activate function is called automatically when this screen is "switched in"
     * (ie. made active). Initialization logic can be placed here.
     */
    virtual void activate();

    /**
     * The deactivate function is called automatically when this screen is "switched out"
     * (ie. made inactive). Teardown functionality can be placed here.
     */
    virtual void deactivate();

    virtual ~defects_injPresenter() {}

private:
    defects_injPresenter();

    defects_injView& view;
};

#endif // DEFECTS_INJPRESENTER_HPP
